import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getOpenAI, friendlyOpenAIError } from "../lib/openai";
import { runTextChat } from "../lib/chat";
import { ChatAction } from "../types";
import { executeAction } from "../lib/actions";
import { createHash } from "crypto";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 2, fileSize: 8 * 1024 * 1024 } });

const pendingActions = new Map<string, { userId: string; action: ChatAction; expiresAt: number }>();

type RecetteData = {
  stock: {
    worker: string | null;
    lines: Array<{ item: string; start: number | null; ajout: number | null; fin: number | null; unit: string | null; confidence: number | null }>;
    cashCaisse: number | null;
    depense: number | null;
    staffSalaire: number | null;
    ramiGames: number | null;
  };
  ticket: {
    lines: Array<{ category: string | null; product: string; qte: number | null; ratio: number | null; unitPrice: number | null; total: number | null; confidence: number | null }>;
    ticketTotal: number | null;
  };
  notes: string[];
};

type RecetteSession = {
  userId: string;
  state: "REVIEW_DATA" | "REVIEW_CORRECTIONS" | "READY_TO_RECORD" | "RECORDED";
  final?: RecetteFinal;
  recordedShiftId?: string;
  calculations?: RecetteCalculations;
  data: RecetteData;
  originalData: RecetteData;
  model: string;
  createdAt: number;
  updatedAt: number;
};



type CorrectionDecision = "PENDING" | "ACCEPTED" | "REJECTED" | "MODIFIED";
type RecetteCorrection = {
  code: string; label: string; actual: number; expected: number; difference: number;
  price: number; priceLabel: string; automaticAmount: number; acceptedAmount: number; decision: CorrectionDecision; note: string;
};
type RecetteFinal = {
  cashCaisse: number; ramiGames: number; ramiMultiplier: number; ramiValue: number;
  depense: number; staffSalaire: number; automaticCorrectionTotal: number; acceptedCorrectionTotal: number;
  recetteBeforeCorrection: number; recetteFinale: number; ticketTotal: number;
};

type RecetteCalculations = {
  corrections: RecetteCorrection[];
  automaticCorrectionTotal: number;
  acceptedCorrectionTotal: number;
  coffee: { soldCoffees: number; beansConsumed: number | null; coffeesPerBeanUnit: number | null };
  chicha: { total: number; personnel: number; normal: number; tombacConsumed: number | null; tombacPerNormalChicha: number | null };
};

const MOCK_RECETTE: RecetteData = {
  stock: {
    worker: "MOCK - Rami",
    lines: [
      { item: "EAU 1.5L", start: 24, ajout: 12, fin: 29, unit: "pcs", confidence: 1 },
      { item: "EAU 0.5L", start: 40, ajout: 24, fin: 48, unit: "pcs", confidence: 1 },
      { item: "GAZEUSE", start: 30, ajout: 0, fin: 25, unit: "pcs", confidence: 1 },
      { item: "CANNETTE", start: 24, ajout: 12, fin: 29, unit: "pcs", confidence: 1 },
      { item: "EAU 1L", start: 12, ajout: 0, fin: 10, unit: "pcs", confidence: 1 },
      { item: "CITRON", start: 5, ajout: 0, fin: 3.8, unit: "L", confidence: 1 },
      { item: "COFFEE BEANS", start: 3, ajout: 0, fin: 2.5, unit: "kg", confidence: 1 },
      { item: "TOMBAC", start: 1000, ajout: 0, fin: 850, unit: "g", confidence: 1 }
    ],
    cashCaisse: 186, depense: 12, staffSalaire: 20, ramiGames: 4
  },
  ticket: {
    lines: [
      { category: "BOISSON", product: "EAU 1.5L", qte: 6, ratio: null, unitPrice: 1.5, total: 9, confidence: 1 },
      { category: "BOISSON", product: "EAU 0.5L", qte: 12, ratio: null, unitPrice: 0.8, total: 9.6, confidence: 1 },
      { category: "CAFE", product: "KAMIA", qte: 2, ratio: null, unitPrice: 0, total: 0, confidence: 1 },
      { category: "BOISSON", product: "BOISSON GAZEUZE", qte: 5, ratio: null, unitPrice: 1.5, total: 7.5, confidence: 1 },
      { category: "BOISSON", product: "CANETTE", qte: 5, ratio: null, unitPrice: 2, total: 10, confidence: 1 },
      { category: "JUS", product: "CITRON", qte: 5, ratio: null, unitPrice: 2.5, total: 12.5, confidence: 1 },
      { category: "CAFE", product: "EXPRESS", qte: 14, ratio: null, unitPrice: 1.5, total: 21, confidence: 1 },
      { category: "CAFE", product: "CAPUCIN", qte: 6, ratio: null, unitPrice: 2, total: 12, confidence: 1 },
      { category: "CHICHA", product: "MENTHE", qte: 8, ratio: null, unitPrice: 5, total: 40, confidence: 1 },
      { category: "CHICHA", product: "POMME", qte: 3, ratio: null, unitPrice: 5, total: 15, confidence: 1 },
      { category: "CHICHA", product: "CHICHA PERSONEL", qte: 1, ratio: null, unitPrice: 0, total: 0, confidence: 1 }
    ], ticketTotal: 136.6
  },
  notes: ["MODE MOCK : aucune photo ni API OpenAI utilisée."]
};

// /recette state is temporary until the exact final command OUI ENREGISTRE. Phase 3 persists atomically.
const recetteSessions = new Map<string, RecetteSession>();
const RECETTE_TTL = 60 * 60 * 1000;

const RECETTE_VISION_PROMPT = `Tu extrais les données de DEUX documents réels de clôture du café Saraya. Les deux images peuvent arriver dans n'importe quel ordre.

DOCUMENT STOCK :
- Titre possible : "SARAYA SHIFT STOCK".
- Colonnes : ARTICLE, START, AJOUT, FIN.
- Lignes possibles : EAU 1.5L, EAU 0.5L, GAZEUSE, Cannette, EAU 1L, EAU BOLAR, Citron, Coffee beans, Tombac.
- À droite peuvent apparaître : Cash caisse, Depense, Staff Salaire, Rami Game.
- WORKER peut être absent.
- Les valeurs peuvent contenir leur unité dans la cellule (ex. "3 L", "800 g"). Retourne le nombre séparément et l'unité dans unit.

DOCUMENT TICKET POS :
- Colonnes réelles possibles : Libellé, Qte, Ratio(%), Total. Il peut NE PAS y avoir de colonne Prix.
- Ratio(%) est un pourcentage : NE LE CONFONDS JAMAIS avec le prix.
- Les titres BOISSON, CHICHA, CAFE, JUS, etc. sont des catégories, pas des ventes.
- Les sous-totaux de catégorie (ex. 27,800 / 44,000 / 26,200) ne sont PAS des produits.
- "TOTAL ARTICLES" est ticketTotal.
- Pour chaque vraie ligne produit, extrais category, product, qte, ratio et total.
- Si qte et total sont lisibles mais aucun prix unitaire n'est imprimé, mets unitPrice à null : le backend le calculera ensuite.

RÈGLES :
- N'invente JAMAIS une valeur. Valeur absente/illisible = null.
- Les virgules décimales françaises doivent devenir des nombres JSON (ex. 98,000 => 98 ; 2,88 => 2.88).
- Conserve les lignes visibles.
- confidence doit être un nombre 0..1 ou null.
- Ajoute une note courte pour toute ambiguïté.
- Retourne UNIQUEMENT du JSON, sans markdown.

Structure exacte :
{
  "stock": {
    "worker": null,
    "lines": [{"item":"EAU 1.5L","start":null,"ajout":null,"fin":null,"unit":"pcs","confidence":null}],
    "cashCaisse": null,
    "depense": null,
    "staffSalaire": null,
    "ramiGames": null
  },
  "ticket": {
    "lines": [{"category":null,"product":"MENTHE","qte":null,"ratio":null,"unitPrice":null,"total":null,"confidence":null}],
    "ticketTotal": null
  },
  "notes": []
}`;

const RECETTE_EDIT_PROMPT = `Tu modifies uniquement des données déjà extraites pour une clôture /recette Saraya.
Le propriétaire va donner une correction en langage naturel. Applique UNIQUEMENT ce qu'il demande au JSON existant.
Ne calcule aucune correction financière, ne déduis aucun stock et n'ajoute aucune valeur non demandée.
Conserve toutes les autres valeurs exactement telles quelles.
Retourne UNIQUEMENT le JSON complet corrigé, avec exactement la même structure.`;

async function presentRecetteWithAI(client:any, stage:string, payload:any, fallback:string) {
  // Presentation is optional. The deterministic /recette workflow must NEVER
  // depend on OpenAI after the two source photos have been extracted.
  if (!client) return fallback;
  try {
    const response=await client.chat.completions.create({
      model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
      messages:[
        {role:"system",content:`Vous présentez au propriétaire du café Saraya un résultat /recette DÉJÀ calculé par le backend. Vous ne recalculez rien, ne modifiez aucun nombre et n'inventez aucune cause. Français simple, lisible, maximum 10 lignes. Commencez par l'information utile, regroupez les détails techniques. Si des écarts existent, dites seulement qu'ils existent. Terminez par la commande exacte attendue. Le propriétaire peut écrire "MONTRE MOI LE DETAIL" pour voir le calcul backend complet.`},
        {role:"user",content:`Étape: ${stage}\nDonnées backend vérifiées:\n${JSON.stringify(payload)}`}
      ],temperature:0.1
    });
    return response.choices[0]?.message?.content?.trim()||fallback;
  } catch(e){ console.warn("RECETTE PRESENTATION AI FALLBACK",e instanceof Error?e.message:e); return fallback; }
}

router.post("/", upload.array("images", 2), async (req, res) => {
  try {
    const userId = (req as import("../types").AuthenticatedRequest).auth!.userId;
    cleanupRecetteSessions();

    const body = z.object({
      message: z.string().max(5000).optional().default(""),
      history: z.string().optional()
    }).parse(req.body);

    const images = (req.files as Express.Multer.File[] | undefined) || [];
    const text = body.message.trim();
    const isMockRecette = /^(?:\/recette\s+mock|\/recette_mock)$/i.test(text);
    const isRecette = /^\/recette\b/i.test(text) || /^\/recette_mock$/i.test(text);
    const session = recetteSessions.get(userId);

    // OpenAI is created lazily: mock /recette and deterministic Phase 2 work without API billing.
    const getClient = async () => {
      const shop = await prisma.shop.findFirst();
      return getOpenAI(process.env.OPENAI_API_KEY?.trim() || (shop?.openaiKey?.startsWith("sk-") ? shop.openaiKey : undefined));
    };

    // Start/restart Phase 1 /recette extraction.
    if (isRecette) {
      if (isMockRecette) {
        const data = structuredClone(MOCK_RECETTE);
        recetteSessions.set(userId, { userId, state: "REVIEW_DATA", data, originalData: structuredClone(data), model: "mock", createdAt: Date.now(), updatedAt: Date.now() });
        return res.json({ answer: `🧪 MODE MOCK /recette — Phase 3/4 local, aucune API OpenAI utilisée.\n\n${formatRecetteReview(data, false)}`, recetteState: "REVIEW_DATA", recetteData: data, requiresConfirmation: false, action: null, preview: null, source: "mock /recette local" });
      }
      if (images.length !== 2) {
        return res.status(400).json({
          error: "Pour /recette, envoyez exactement 2 photos : la feuille SARAYA SHIFT STOCK et le ticket caisse."
        });
      }

      const client = await getClient();
      const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
      const content: any[] = [{ type: "text", text: RECETTE_VISION_PROMPT }];
      for (const image of images) {
        const mime = image.mimetype.startsWith("image/") ? image.mimetype : "image/jpeg";
        content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${image.buffer.toString("base64")}` } });
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content }],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const data = parseAndValidateRecette(completion.choices[0]?.message?.content || "");
      recetteSessions.set(userId, {
        userId,
        state: "REVIEW_DATA",
        data,
        originalData: structuredClone(data),
        model,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const reviewFallback=formatRecetteReview(data, false);
      const reviewAnswer=await presentRecetteWithAI(client,"REVIEW_DATA",{data,commande:"CONFIRME DONNÉES"},reviewFallback);
      return res.json({
        answer: reviewAnswer,
        recetteState: "REVIEW_DATA",
        recetteData: data,
        requiresConfirmation: false,
        action: null,
        preview: null,
        source: "2 photos /recette analysées"
      });
    }

    // Phase 4 — explicit analytics commands must never be swallowed by a completed /recette session.
    // Keep this BEFORE all recette session-state handling.
    if (/^\/(?:analyse|analytics)\b/i.test(text)) {
      const answer = await runAnalyticsCommand(text);
      return res.json({ answer, requiresConfirmation: false, action: null, preview: null, source: "PostgreSQL analytics Saraya" });
    }

    // A /recette is being reviewed: confirmation and owner edits take priority over normal chat.
    if (session && /^(?:MONTRE|AFFICHE)(?: MOI)? (?:LE )?D[ÉE]TAILS?$/i.test(text.trim())) {
      if(session.state==="REVIEW_DATA") return res.json({answer:formatRecetteReview(session.data,false),recetteState:session.state,requiresConfirmation:false,action:null,preview:null});
      if(session.state==="REVIEW_CORRECTIONS") return res.json({answer:formatCorrectionReview(session.calculations!),recetteState:session.state,requiresConfirmation:false,action:null,preview:null});
      if((session.state==="READY_TO_RECORD"||session.state==="RECORDED")&&session.final) return res.json({answer:formatFinalRecette(session.final),recetteState:session.state,requiresConfirmation:false,action:null,preview:null});
    }
    if (session?.state === "REVIEW_DATA") {
      if (normalizeCommand(text) === "CONFIRME DONNEES") {
        session.state = "REVIEW_CORRECTIONS";
        session.calculations = calculateRecette(session.data);
        session.updatedAt = Date.now();
        const fallback=`✅ Données /recette confirmées.\n\n${formatCorrectionReview(session.calculations)}`;
        const answer=fallback;
        return res.json({
          answer,
          recetteState: "REVIEW_CORRECTIONS",
          recetteData: session.data,
          recetteCalculations: session.calculations,
          requiresConfirmation: false,
          action: null,
          preview: null
        });
      }

      if (!text) {
        return res.json({
          answer: "La /recette attend votre vérification. Écrivez une correction (ex. « EAU 0.5L FIN = 12 ») ou envoyez exactement « CONFIRME DONNÉES ».",
          recetteState: "REVIEW_DATA",
          recetteData: session.data,
          requiresConfirmation: false,
          action: null,
          preview: null
        });
      }

      const edited = session.model === "mock"
        ? applyMockRecetteEdit(session.data, text)
        : await applyRecetteEdit(await getClient(), session.model, session.data, text);
      session.data = edited;
      session.updatedAt = Date.now();
      return res.json({
        answer: `Modification appliquée.\n\n${formatRecetteReview(edited, true)}`,
        recetteState: "REVIEW_DATA",
        recetteData: edited,
        requiresConfirmation: false,
        action: null,
        preview: null,
        source: "Données /recette corrigées par le propriétaire"
      });
    }

    if (session?.state === "REVIEW_CORRECTIONS") {
      const cmd = normalizeCommand(text);
      if (cmd === "CONFIRME CORRECTIONS") {
        const verified = verifyRecetteCalculations(session.data, session.calculations!);
        session.calculations = verified.calculations;
        session.final = verified.final;
        session.state = "READY_TO_RECORD";
        session.updatedAt = Date.now();
        const fallback=`✅ Corrections confirmées et revérifiées par le backend.\n\n${formatFinalRecette(verified.final)}\n\n⚠️ Rien n'est encore enregistré et aucun stock n'a été modifié.\nPour enregistrer définitivement ce shift, envoyez exactement : OUI ENREGISTRE`;
        const answer=fallback;
        return res.json({
          answer,
          recetteState: "READY_TO_RECORD", recetteData: session.data, recetteCalculations: session.calculations, recetteFinal: session.final,
          requiresConfirmation: false, action: null, preview: null
        });
      }

      const changed = applyCorrectionDecision(session.calculations!, text);
      if (!changed) {
        return res.json({ answer: `${formatCorrectionReview(session.calculations!)}\n\nCommande non reconnue. Exemples : « ACCEPTE TOUT », « REJETTE EAU 0.5L », « MODIFIE CANNETTE = -2.000 ».`, recetteState: "REVIEW_CORRECTIONS", recetteData: session.data, recetteCalculations: session.calculations, requiresConfirmation: false, action: null, preview: null });
      }
      session.updatedAt = Date.now();
      const fallback=`Décision appliquée.\n\n${formatCorrectionReview(session.calculations!)}`;
      const answer=fallback;
      return res.json({ answer, recetteState: "REVIEW_CORRECTIONS", recetteData: session.data, recetteCalculations: session.calculations, requiresConfirmation: false, action: null, preview: null });
    }

    if (session?.state === "READY_TO_RECORD") {
      if (normalizeCommand(text) !== "OUI ENREGISTRE") {
        return res.json({ answer: `${formatFinalRecette(session.final!)}\n\nRien n'est encore enregistré. Pour valider définitivement : OUI ENREGISTRE`, recetteState: "READY_TO_RECORD", recetteData: session.data, recetteCalculations: session.calculations, recetteFinal: session.final, requiresConfirmation: false, action: null, preview: null });
      }
      const recorded = await recordRecetteAtomically(userId, session);
      session.state = "RECORDED";
      session.recordedShiftId = recorded.shiftId;
      session.updatedAt = Date.now();
      const fallback=`✅ SHIFT ENREGISTRÉ\n\n${formatFinalRecette(recorded.final)}\n\nStock physique, ventes, corrections, dépenses, métriques et audit enregistrés dans PostgreSQL en une seule transaction.\nRéférence shift : ${recorded.shiftId}`;
      const answer=fallback;
      return res.json({ answer, recetteState: "RECORDED", recetteData: session.data, recetteCalculations: session.calculations, recetteFinal: recorded.final, shiftId: recorded.shiftId, requiresConfirmation: false, action: null, preview: null });
    }

    if (session?.state === "RECORDED" && normalizeCommand(text) === "OUI ENREGISTRE") {
      return res.json({ answer: `Ce shift est déjà enregistré. Aucune deuxième écriture n'a été effectuée.\nRéférence shift : ${session.recordedShiftId}`, recetteState: "RECORDED", shiftId: session.recordedShiftId, requiresConfirmation: false, action: null, preview: null });
    }

    // Existing generic photo analysis remains available outside /recette.
    if (images.length > 0) {
      return res.status(400).json({ error: "Pour la clôture complète, écrivez /recette et joignez exactement 2 photos." });
    }

    const history = body.history ? JSON.parse(body.history) : [];
    const client = await getClient();
    const result = await runTextChat(client, body.message, Array.isArray(history) ? history : []);

    if (result.action) {
      const actionId = cryptoRandomId();
      pendingActions.set(actionId, { userId, action: result.action, expiresAt: Date.now() + 5 * 60 * 1000 });
      return res.json({ answer: result.answer, requiresConfirmation: true, actionId, preview: result.preview, action: result.action });
    }

    return res.json({ answer: result.answer, requiresConfirmation: false, action: null, preview: null });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    const message = error instanceof Error && error.message === "NO_OPENAI_KEY"
      ? "Ajoutez votre clé OpenAI dans les paramètres."
      : error instanceof Error && error.message.startsWith("RECETTE_")
        ? error.message.replace("RECETTE_", "")
        : friendlyOpenAIError(error);
    res.status(400).json({ error: message });
  }
});

router.post("/confirm", async (req, res) => {
  try {
    const body = z.object({ actionId: z.string() }).parse(req.body);
    const pending = pendingActions.get(body.actionId);
    if (!pending || pending.expiresAt < Date.now() || pending.userId !== (req as import("../types").AuthenticatedRequest).auth!.userId) {
      return res.status(404).json({ error: "Cette action n'est plus disponible." });
    }
    pendingActions.delete(body.actionId);
    const result = await executeAction(pending.action);
    res.json({ answer: result.message });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Impossible d'exécuter l'action." });
  }
});

router.post("/cancel", async (req, res) => {
  const body = z.object({ actionId: z.string() }).parse(req.body);
  pendingActions.delete(body.actionId);
  res.json({ answer: "Action annulée." });
});

function parseAndValidateRecette(raw: string): RecetteData {
  let parsed: any;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("RECETTE_OpenAI n'a pas retourné un JSON lisible. Réessayez la demande.");
  }

  // OpenAI can occasionally omit optional/null fields or return a numeric value as text.
  // Normalize those harmless differences here; never invent a missing business value.
  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const m = v.trim().replace(/\s/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
      if (!m) return null;
      const n = Number(m[0]);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const textOrNull = (v: any) => typeof v === "string" && v.trim() ? v.trim() : null;
  const stock = parsed?.stock ?? {};
  const ticket = parsed?.ticket ?? {};
  const normalized: RecetteData = {
    stock: {
      worker: textOrNull(stock.worker),
      lines: Array.isArray(stock.lines) ? stock.lines.filter((x:any)=>x && (x.item || x.article || x.product)).map((x:any) => ({
        item: String(x.item ?? x.article ?? x.product).trim(), start: num(x.start), ajout: num(x.ajout ?? x.added), fin: num(x.fin ?? x.end),
        unit: textOrNull(x.unit ?? x.unite), confidence: num(x.confidence)
      })) : [],
      cashCaisse: num(stock.cashCaisse ?? stock.cash_caisse ?? stock.cash),
      depense: num(stock.depense ?? stock.expense),
      staffSalaire: num(stock.staffSalaire ?? stock.staff_salaire ?? stock.salary),
      ramiGames: num(stock.ramiGames ?? stock.ramiGame ?? stock.rami_game)
    },
    ticket: {
      lines: Array.isArray(ticket.lines) ? ticket.lines.filter((x:any)=>x && (x.product || x.libelle || x.item)).map((x:any) => {
        const qte=num(x.qte ?? x.quantity); const total=num(x.total); let unitPrice=num(x.unitPrice ?? x.unit_price ?? x.prix);
        if (unitPrice === null && qte !== null && qte !== 0 && total !== null) unitPrice = Math.round((total/qte)*1000)/1000;
        return { category:textOrNull(x.category ?? x.categorie), product:String(x.product ?? x.libelle ?? x.item).trim(), qte, ratio:num(x.ratio), unitPrice, total, confidence:num(x.confidence) };
      }) : [],
      ticketTotal: num(ticket.ticketTotal ?? ticket.ticket_total ?? ticket.totalArticles ?? ticket.total_articles)
    },
    notes: Array.isArray(parsed?.notes) ? parsed.notes.filter((x:any)=>typeof x === "string") : []
  };

  if (!normalized.stock.lines.length || !normalized.ticket.lines.length) {
    throw new Error("RECETTE_Les deux documents ont été reçus, mais OpenAI n'a pas identifié les lignes stock et ticket. Vérifiez que les deux documents complets sont visibles.");
  }
  return normalized;
}

async function applyRecetteEdit(client: ReturnType<typeof getOpenAI>, model: string, current: RecetteData, instruction: string) {
  const completion = await client.chat.completions.create({
    model,
    messages: [{
      role: "user",
      content: `${RECETTE_EDIT_PROMPT}\n\nJSON ACTUEL:\n${JSON.stringify(current)}\n\nCORRECTION DU PROPRIÉTAIRE:\n${instruction}`
    }],
    temperature: 0,
    response_format: { type: "json_object" }
  });
  return parseAndValidateRecette(completion.choices[0]?.message?.content || "");
}

function formatRecetteReview(data: RecetteData, afterEdit: boolean) {
  const n = (v: number | null) => v == null ? "?" : String(v);
  const money = (v: number | null) => v == null ? "?" : `${v.toFixed(3)} DT`;
  const stockLines = data.stock.lines.length
    ? data.stock.lines.map((x) => `• ${x.item}: START ${n(x.start)} | AJOUT ${n(x.ajout)} | FIN ${n(x.fin)}${x.unit ? ` ${x.unit}` : ""}`).join("\n")
    : "• Aucune ligne stock lisible";
  const sales = data.ticket.lines.length
    ? data.ticket.lines.map((x) => `• ${x.category || "?"} — ${x.product}: Qte ${n(x.qte)} | Ratio ${n(x.ratio)} | Prix ${money(x.unitPrice)} | Total ${money(x.total)}`).join("\n")
    : "• Aucune ligne ticket lisible";
  const notes = data.notes.length ? `\n\n⚠️ Notes de lecture:\n${data.notes.map((x) => `• ${x}`).join("\n")}` : "";

  return `${afterEdit ? "Vérifiez de nouveau les données :" : "J'ai extrait les 2 photos. Vérifiez toutes les données avant de continuer."}\n\nFEUILLE STOCK\nWorker: ${data.stock.worker || "?"}\n${stockLines}\n\nCash caisse: ${money(data.stock.cashCaisse)}\nDépense: ${money(data.stock.depense)}\nStaff salaire: ${money(data.stock.staffSalaire)}\nRami Games: ${n(data.stock.ramiGames)}\n\nTICKET CAISSE\n${sales}\n\nTotal ticket: ${money(data.ticket.ticketTotal)}${notes}\n\nSi une valeur est fausse, écrivez simplement la correction (ex. « EAU 0.5L FIN = 12 » ou « MENTHE Qte = 8 »).\nQuand tout est correct, envoyez exactement : CONFIRME DONNÉES`;
}

function canonical(value: string) {
  return normalizeCommand(value).replace(/[^A-Z0-9.]+/g, " ").trim();
}

function actualConsumption(data: RecetteData, names: string[]) {
  const wanted = names.map(canonical);
  const line = data.stock.lines.find(x => wanted.includes(canonical(x.item)));
  if (!line || line.start == null || line.ajout == null || line.fin == null) return null;
  return round3(line.start + line.ajout - line.fin);
}

function sold(data: RecetteData, names: string[]) {
  const wanted = names.map(canonical);
  return round3(data.ticket.lines.filter(x => wanted.includes(canonical(x.product))).reduce((sum, x) => sum + (x.qte || 0), 0));
}

function makeCorrection(code: string, label: string, actual: number | null, expected: number, positivePrice: number, negativePrice = positivePrice, positiveLabel = "prix article", negativeLabel = positiveLabel): RecetteCorrection | null {
  if (actual == null) return null;
  const difference = round3(actual - expected);
  const price = difference >= 0 ? positivePrice : negativePrice;
  const amount = round3(difference * price);
  return { code, label, actual, expected: round3(expected), difference, price, priceLabel: difference >= 0 ? positiveLabel : negativeLabel, automaticAmount: amount, acceptedAmount: amount, decision: "PENDING", note: difference === 0 ? "Aucun écart" : difference > 0 ? "Consommation réelle supérieure aux ventes attendues" : "Ventes attendues supérieures à la consommation réelle" };
}

function calculateRecette(data: RecetteData): RecetteCalculations {
  const corrections: RecetteCorrection[] = [];
  const push = (x: RecetteCorrection | null) => { if (x) corrections.push(x); };
  push(makeCorrection("EAU_15", "EAU 1.5L", actualConsumption(data,["EAU 1.5L"]), sold(data,["EAU 1.5L"]), 1.5));
  const eau05Expected = sold(data,["EAU 0.5L"]) + sold(data,["KAMIA"]);
  push(makeCorrection("EAU_05", "EAU 0.5L (+ KAMIA)", actualConsumption(data,["EAU 0.5L"]), eau05Expected, 5.0, 0.8, "prix CHICHA", "prix EAU 0.5L"));
  push(makeCorrection("EAU_1L", "EAU 1L", actualConsumption(data,["EAU 1L"]), sold(data,["EAU 1L"]), 1.5));
  push(makeCorrection("GAZEUSE", "GAZEUSE", actualConsumption(data,["GAZEUSE"]), sold(data,["BOISSON GAZEUZE","GAZEUSE"]), 1.5));
  push(makeCorrection("CANNETTE", "CANNETTE", actualConsumption(data,["CANNETTE","CANETTE"]), sold(data,["CANETTE","CANNETTE"]), 2.0));
  const citronActual = actualConsumption(data,["CITRON"]);
  const citronSold = sold(data,["CITRON"]);
  if (citronActual != null) {
    const expectedL = round3(citronSold * 0.2);
    const diffL = round3(citronActual - expectedL);
    const cups = round3(diffL / 0.2);
    const amount = round3(cups * 2.5);
    corrections.push({ code:"CITRON", label:"CITRON", actual:citronActual, expected:expectedL, difference:diffL, price:2.5, priceLabel:"2.500 DT / verre (0.2 L)", automaticAmount:amount, acceptedAmount:amount, decision:"PENDING", note:`Écart ${diffL.toFixed(3)} L = ${cups.toFixed(3)} verre(s)` });
  }
  const coffeeNames=["CAPUCIN","DIRECT","EXPRESS","FILTRE","AMERICAIN","SPECIALE","ALLONGE","DEMI ALLONGE","SANS MOUSSE","SERRE"];
  const soldCoffees=sold(data,coffeeNames);
  const beansConsumed=actualConsumption(data,["COFFEE BEANS","CAFE GRAINS","CAFÉ GRAINS"]);
  const coffeeRatio=beansConsumed && beansConsumed!==0 ? round3(soldCoffees/beansConsumed) : null;
  const chichaLines=data.ticket.lines.filter(x=>canonical(x.category||"")==="CHICHA");
  const total=round3(chichaLines.reduce((a,x)=>a+(x.qte||0),0));
  const personnel=round3(chichaLines.filter(x=>canonical(x.product).includes("PERSONEL")||canonical(x.product).includes("PERSONNEL")).reduce((a,x)=>a+(x.qte||0),0));
  const normal=round3(total-personnel);
  const tombacConsumed=actualConsumption(data,["TOMBAC","TAMBAC"]);
  const tombacRatio=tombacConsumed!=null && normal>0 ? round3(tombacConsumed/normal) : null;
  const automaticCorrectionTotal=round3(corrections.reduce((a,x)=>a+x.automaticAmount,0));
  return { corrections, automaticCorrectionTotal, acceptedCorrectionTotal: automaticCorrectionTotal, coffee:{soldCoffees,beansConsumed,coffeesPerBeanUnit:coffeeRatio}, chicha:{total,personnel,normal,tombacConsumed,tombacPerNormalChicha:tombacRatio} };
}

function recomputeAcceptedTotal(c: RecetteCalculations) { c.acceptedCorrectionTotal=round3(c.corrections.reduce((a,x)=>a+x.acceptedAmount,0)); }

function applyCorrectionDecision(c: RecetteCalculations, text: string) {
  const cmd=normalizeCommand(text);
  if (cmd === "ACCEPTE TOUT" || cmd === "ACCEPTER TOUT") { c.corrections.forEach(x=>{x.decision="ACCEPTED";x.acceptedAmount=x.automaticAmount}); recomputeAcceptedTotal(c); return true; }
  if (cmd === "REJETTE TOUT" || cmd === "REJETER TOUT") { c.corrections.forEach(x=>{x.decision="REJECTED";x.acceptedAmount=0}); recomputeAcceptedTotal(c); return true; }
  const action = cmd.startsWith("ACCEPTE ") ? "ACCEPTED" : cmd.startsWith("REJETTE ") ? "REJECTED" : cmd.startsWith("MODIFIE ") ? "MODIFIED" : null;
  if (!action) return false;
  const targetText=cmd.replace(/^(ACCEPTE|REJETTE|MODIFIE)\s+/,"").split("=")[0].trim();
  const target=c.corrections.find(x=>canonical(x.label).includes(canonical(targetText)) || canonical(x.code)===canonical(targetText));
  if (!target) return false;
  if (action === "ACCEPTED") { target.decision="ACCEPTED";target.acceptedAmount=target.automaticAmount; }
  else if (action === "REJECTED") { target.decision="REJECTED";target.acceptedAmount=0; }
  else { const m=text.match(/=\s*(-?\d+(?:[.,]\d+)?)/); if(!m) return false; target.decision="MODIFIED";target.acceptedAmount=round3(Number(m[1].replace(",","."))); }
  recomputeAcceptedTotal(c); return true;
}

function formatCorrectionReview(c: RecetteCalculations) {
  const lines=c.corrections.map(x=>`• ${x.label}: réel ${x.actual} | attendu ${x.expected} | écart ${x.difference} | tarif ${x.price.toFixed(3)} DT (${x.priceLabel}) | auto ${money3(x.automaticAmount)} | retenu ${money3(x.acceptedAmount)} | ${x.decision}`);
  return `PHASE 2 — CALCUL DÉTERMINISTE DES CORRECTIONS\
\
${lines.join("\
")}\
\
Total automatique: ${money3(c.automaticCorrectionTotal)}\
Total retenu: ${money3(c.acceptedCorrectionTotal)}\
\
☕ Café: ${c.coffee.soldCoffees} cafés | beans consommés ${c.coffee.beansConsumed ?? "?"} | ratio ${c.coffee.coffeesPerBeanUnit ?? "?"} cafés/unité beans\
💨 Chicha: total ${c.chicha.total} | personnel ${c.chicha.personnel} | normal ${c.chicha.normal} | tombac ${c.chicha.tombacConsumed ?? "?"} | ratio ${c.chicha.tombacPerNormalChicha ?? "?"} tombac/chicha normale\
\
Décidez : ACCEPTE TOUT, REJETTE <article>, ACCEPTE <article>, ou MODIFIE <article> = montant.\
Quand terminé : CONFIRME CORRECTIONS`;
}

function applyMockRecetteEdit(data: RecetteData, instruction: string): RecetteData {
  const out=structuredClone(data);
  const m=instruction.match(/^(.+?)\s+(START|AJOUT|FIN)\s*=\s*(-?\d+(?:[.,]\d+)?)$/i);
  if(m){ const line=out.stock.lines.find(x=>canonical(x.item)===canonical(m[1])); if(!line) throw new Error("RECETTE_Article stock mock introuvable."); (line as any)[m[2].toLowerCase()]=Number(m[3].replace(",",".")); return out; }
  const q=instruction.match(/^(.+?)\s+QTE\s*=\s*(-?\d+(?:[.,]\d+)?)$/i);
  if(q){ const line=out.ticket.lines.find(x=>canonical(x.product)===canonical(q[1])); if(!line) throw new Error("RECETTE_Produit ticket mock introuvable."); line.qte=Number(q[2].replace(",",".")); return out; }
  throw new Error("RECETTE_En mode mock, utilisez par exemple « EAU 0.5L FIN = 12 » ou « MENTHE Qte = 8 ».");
}


function verifyRecetteCalculations(data: RecetteData, owner: RecetteCalculations) {
  const fresh = calculateRecette(data);
  const byCode = new Map(owner.corrections.map(x => [x.code, x]));
  if (fresh.corrections.length !== owner.corrections.length) throw new Error("RECETTE_La vérification finale a détecté un changement dans les corrections.");
  for (const correction of fresh.corrections) {
    const prior = byCode.get(correction.code);
    if (!prior || Math.abs(prior.automaticAmount - correction.automaticAmount) > 0.0005) throw new Error(`RECETTE_La correction ${correction.label} ne correspond plus au calcul backend.`);
    if (prior.decision === "PENDING") throw new Error(`RECETTE_Décision manquante pour ${correction.label}. Acceptez, rejetez ou modifiez cette correction avant de confirmer.`);
    correction.decision = prior.decision;
    correction.acceptedAmount = prior.decision === "ACCEPTED" ? correction.automaticAmount : prior.decision === "REJECTED" ? 0 : round3(prior.acceptedAmount);
  }
  recomputeAcceptedTotal(fresh);
  const cash = requiredMoney(data.stock.cashCaisse, "Cash caisse");
  const depense = requiredMoney(data.stock.depense, "Dépense");
  const salary = requiredMoney(data.stock.staffSalaire, "Staff salaire");
  const games = requiredMoney(data.stock.ramiGames, "Rami Games");
  const ticket = requiredMoney(data.ticket.ticketTotal, "Total ticket");
  const ramiMultiplier = 1.5;
  const ramiValue = round3(games * ramiMultiplier);
  const before = round3(cash + ramiValue - depense - salary);
  const final: RecetteFinal = { cashCaisse:cash, ramiGames:games, ramiMultiplier, ramiValue, depense, staffSalaire:salary, automaticCorrectionTotal:fresh.automaticCorrectionTotal, acceptedCorrectionTotal:fresh.acceptedCorrectionTotal, recetteBeforeCorrection:before, recetteFinale:round3(before + fresh.acceptedCorrectionTotal), ticketTotal:ticket };
  return { calculations: fresh, final };
}

function requiredMoney(value: number | null, label: string) {
  if (value == null || !Number.isFinite(value)) throw new Error(`RECETTE_${label} est manquant ou invalide.`);
  return round3(value);
}

function formatFinalRecette(f: RecetteFinal) {
  return `💰 RECETTE FINALE\n\nCash caisse: ${money3(f.cashCaisse)}\nRami Games: ${f.ramiGames} × ${f.ramiMultiplier.toFixed(3)} = +${money3(f.ramiValue)}\nCorrections retenues: ${f.acceptedCorrectionTotal >= 0 ? "+" : ""}${money3(f.acceptedCorrectionTotal)}\nDépenses: -${money3(f.depense)}\nStaff salaire: -${money3(f.staffSalaire)}\n\nRECETTE FINALE = ${money3(f.recetteFinale)}\nTicket caisse (séparé): ${money3(f.ticketTotal)}`;
}

function sourceFingerprint(userId: string, data: RecetteData, model?: string, sessionCreatedAt?: number) {
  const day = new Date().toISOString().slice(0,10);
  // Real photo shifts stay idempotent for the same validated source/day. Mock sessions get a test nonce
  // so Phase 3/4 can be re-tested after restoring stock without colliding with an earlier mock shift.
  const mockNonce = model === "mock" ? sessionCreatedAt : undefined;
  return createHash("sha256").update(JSON.stringify({ day, userId, data, mockNonce })).digest("hex");
}

function itemAlias(name: string) {
  const c=canonical(name);
  if (c === "CANETTE" || c === "CANNETTE") return "CANNETTE";
  if (c === "BOISSON GAZEUZE" || c === "GAZEUSE") return "GAZEUSE";
  return name.trim().toUpperCase();
}

async function recordRecetteAtomically(userId: string, session: RecetteSession) {
  const verified = verifyRecetteCalculations(session.data, session.calculations!);
  const fingerprint = sourceFingerprint(userId, session.data, session.model, session.createdAt);
  const existing = await prisma.shift.findUnique({ where: { sourceFingerprint: fingerprint } });
  if (existing) return { shiftId: existing.id, final: verified.final };

  return prisma.$transaction(async tx => {
    const duplicate = await tx.shift.findUnique({ where: { sourceFingerprint: fingerprint } });
    if (duplicate) return { shiftId: duplicate.id, final: verified.final };
    const shop = await tx.shop.findFirst();
    if (!shop) throw new Error("RECETTE_Aucun commerce Saraya n'est configuré.");
    const workerName = session.data.stock.worker?.trim() || "INCONNU";
    const worker = await tx.worker.upsert({ where: { shopId_name: { shopId: shop.id, name: workerName } }, update: { active:true }, create: { shopId:shop.id, name:workerName } });
    const now = new Date();
    const shift = await tx.shift.create({ data: {
      shopId:shop.id, workerId:worker.id, shiftType:"RECETTE", businessDate:now,
      cashExpected:verified.final.ticketTotal, cashCounted:verified.final.cashCaisse, cashVariance:round3(verified.final.cashCaisse-verified.final.ticketTotal),
      cashCaisse:verified.final.cashCaisse, ramiGames:verified.final.ramiGames, ramiMultiplier:verified.final.ramiMultiplier, ramiValue:verified.final.ramiValue,
      ticketTotal:verified.final.ticketTotal, expenseTotal:verified.final.depense, staffSalary:verified.final.staffSalaire,
      automaticCorrectionTotal:verified.final.automaticCorrectionTotal, acceptedCorrectionTotal:verified.final.acceptedCorrectionTotal,
      recetteBeforeCorrection:verified.final.recetteBeforeCorrection, recetteFinale:verified.final.recetteFinale,
      status:"RECORDED", dataConfirmedAt:now, correctionsConfirmedAt:now, recordedAt:now, sourceFingerprint:fingerprint,
      notes: session.model === "mock" ? "Phase 3 /recette — mode mock" : "Phase 3 /recette"
    }});

    const items = await tx.item.findMany({ where:{ archivedAt:null } });
    const itemMap = new Map(items.map(i=>[canonical(i.name),i]));
    for (const line of session.data.stock.lines) {
      const consumed = line.start == null || line.ajout == null || line.fin == null ? null : round3(line.start + line.ajout - line.fin);
      if (consumed != null && consumed < -0.0005) throw new Error(`RECETTE_Stock invalide pour ${line.item}: la consommation calculée est négative.`);
      const item = itemMap.get(canonical(itemAlias(line.item))) || itemMap.get(canonical(line.item));
      const original = session.originalData.stock.lines.find(x=>canonical(x.item)===canonical(line.item));
      await tx.shiftStockLine.create({ data:{ shiftId:shift.id, itemId:item?.id, rawItemName:line.item, normalizedItemName:canonical(line.item), unit:line.unit, startQty:line.start, addedQty:line.ajout, endQty:line.fin, consumedQty:consumed, aiStartQty:original?.start, aiAddedQty:original?.ajout, aiEndQty:original?.fin, extractionConfidence:line.confidence, wasOwnerModified:JSON.stringify(original)!==JSON.stringify(line), originalExtractedValue:(original || line) as any } });
      if (item && consumed != null && consumed > 0) {
        await tx.shiftItem.create({ data:{ shiftId:shift.id, itemId:item.id, consumedQty:consumed } });
        const before=item.quantity;
        // IMPORTANT: START/AJOUT/FIN describe only the shift working stock, not the whole master inventory.
        // Therefore FIN NEVER replaces Item.quantity. We deduct only physical consumption from master stock.
        const consumedInMasterUnit = convertStockQuantity(consumed, line.unit, item.unit);
        const after=round3(before-consumedInMasterUnit);
        if (after < -0.0005) throw new Error(`RECETTE_Stock insuffisant pour ${line.item}: ${before} ${item.unit} disponible, ${consumedInMasterUnit} ${item.unit} consommé.`);
        await tx.item.update({ where:{id:item.id}, data:{quantity:after} });
        await tx.stockMovement.create({ data:{ itemId:item.id, shiftId:shift.id, type:"OUT", quantity:-consumedInMasterUnit, quantityBefore:before, quantityAfter:after, source:"RECETTE", note:`/recette: consommation shift ${consumed} ${line.unit || item.unit} = ${consumedInMasterUnit} ${item.unit}; stock maître ${before} -> ${after}` } });
      }
    }

    const products = await tx.product.findMany({ where:{shopId:shop.id} });
    const productMap = new Map(products.map(p=>[canonical(p.posName),p]));
    for (const line of session.data.ticket.lines) {
      const product=productMap.get(canonical(line.product));
      const original=session.originalData.ticket.lines.find(x=>canonical(x.product)===canonical(line.product));
      await tx.shiftSaleLine.create({ data:{ shiftId:shift.id, productId:product?.id, category:line.category || "INCONNU", rawProductName:line.product, normalizedProductName:canonical(line.product), quantity:line.qte || 0, ratio:line.ratio, unitPrice:line.unitPrice, lineTotal:line.total, extractionConfidence:line.confidence, wasOwnerModified:JSON.stringify(original)!==JSON.stringify(line), originalExtractedValue:(original || line) as any } });
    }

    for (const c of verified.calculations.corrections) {
      const itemName = c.code === "EAU_15" ? "EAU 1.5L" : c.code === "EAU_05" ? "EAU 0.5L" : c.code === "EAU_1L" ? "EAU 1L" : c.code;
      const item=itemMap.get(canonical(itemName));
      await tx.shiftCorrection.create({ data:{ shiftId:shift.id, itemId:item?.id, correctionCode:c.code, expectedQty:c.expected, actualConsumedQty:c.actual, differenceQty:c.difference, calculationRule:c.note, priceUsed:c.price, automaticAmount:c.automaticAmount, acceptedAmount:c.acceptedAmount, decision:c.decision, ownerReason:c.decision === "MODIFIED" ? "Montant modifié par le propriétaire" : null, ownerModifiedAt:c.decision === "MODIFIED" ? now : null } });
    }

    if (verified.final.depense !== 0) await tx.shiftExpense.create({ data:{shiftId:shift.id,type:"DEPENSE",description:"Dépense shift",amount:verified.final.depense} });
    if (verified.final.staffSalaire !== 0) await tx.shiftExpense.create({ data:{shiftId:shift.id,type:"STAFF_SALARY",description:"Salaire staff",amount:verified.final.staffSalaire} });
    const metrics = [
      ["COFFEE_SOLD",verified.calculations.coffee.soldCoffees,"coffee"], ["COFFEE_BEANS_CONSUMED",verified.calculations.coffee.beansConsumed,"kg"], ["COFFEES_PER_BEAN_UNIT",verified.calculations.coffee.coffeesPerBeanUnit,"coffee/unit"],
      ["CHICHA_TOTAL",verified.calculations.chicha.total,"chicha"], ["CHICHA_PERSONNEL",verified.calculations.chicha.personnel,"chicha"], ["CHICHA_NORMAL",verified.calculations.chicha.normal,"chicha"], ["TOMBAC_CONSUMED",verified.calculations.chicha.tombacConsumed,"g"], ["TOMBAC_PER_NORMAL_CHICHA",verified.calculations.chicha.tombacPerNormalChicha,"g/chicha"]
    ] as const;
    for (const [metricCode,value,unit] of metrics) if (value != null) await tx.shiftMetric.create({data:{shiftId:shift.id,metricCode,value,unit}});
    await tx.shiftExtraction.create({data:{shiftId:shift.id,sourceType:session.model === "mock" ? "MOCK" : "TWO_IMAGES",extractedJson:session.originalData as any,validatedJson:session.data as any,aiModel:session.model,sourceHash:fingerprint,validatedAt:now}});
    await tx.shiftAuditEvent.createMany({data:[
      {shiftId:shift.id,eventType:"DATA_CONFIRMED",payload:{at:now.toISOString()}},
      {shiftId:shift.id,eventType:"CORRECTIONS_CONFIRMED",payload:{acceptedTotal:verified.final.acceptedCorrectionTotal}},
      {shiftId:shift.id,eventType:"RECORDED",payload:{recetteFinale:verified.final.recetteFinale,userId}}
    ]});
    return { shiftId:shift.id, final:verified.final };
  });
}

function normalizeUnit(unit: string | null | undefined) {
  return (unit || "").trim().toLowerCase().replace("litres","l").replace("litre","l").replace("pieces","pcs").replace("piece","pcs");
}

function convertStockQuantity(value: number, fromUnit: string | null, toUnit: string | null) {
  const from=normalizeUnit(fromUnit), to=normalizeUnit(toUnit);
  if (!from || !to || from === to) return round3(value);
  if (from === "kg" && to === "g") return round3(value * 1000);
  if (from === "g" && to === "kg") return round3(value / 1000);
  if ((from === "l" || from === "liter") && (to === "l" || to === "liter")) return round3(value);
  if ((from === "pcs" || from === "pc") && (to === "pcs" || to === "pc")) return round3(value);
  throw new Error(`RECETTE_Unité incompatible: impossible de convertir ${fromUnit || "?"} vers ${toUnit || "?"}.`);
}

async function runAnalyticsCommand(raw: string) {
  const cmd=normalizeCommand(raw);
  const shop=await prisma.shop.findFirst();
  if (!shop) throw new Error("RECETTE_Aucun commerce Saraya n'est configuré.");
  const now=new Date();
  const daysMatch=cmd.match(/^\/(?:ANALYSE|ANALYTICS)\s+(\d{1,3})J?$/);
  const days=daysMatch ? Math.max(1, Math.min(365, Number(daysMatch[1]))) : 7;

  if (/^\/(?:ANALYSE|ANALYTICS)\s+(?:AIDE|HELP)$/.test(cmd) || cmd === "/ANALYSE" || cmd === "/ANALYTICS") {
    return `📊 ANALYSE SARAYA — Phase 4\n\nCommandes disponibles :\n/analyse dernier — dernier shift enregistré\n/analyse 7j — résumé des 7 derniers jours (1 à 365)\n/analyse stock — stock actuel + dernières sorties\n/analyse approvisionnement — historique et rythme des ajouts de stock (30 jours)\n/analyse corrections — corrections automatiques/retenues\n/analyse ventes — produits les plus vendus\n/analyse cafe — performance café/beans\n/analyse chicha — performance chicha/tombac\n\nLes réponses viennent uniquement de l'historique PostgreSQL Saraya. Aucune API OpenAI n'est nécessaire.`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+DERNIER$/.test(cmd)) {
    const shift=await prisma.shift.findFirst({where:{shopId:shop.id,status:"RECORDED"},orderBy:{recordedAt:"desc"},include:{worker:true,corrections:true,metrics:true}});
    if (!shift) return "📊 Aucun shift enregistré pour le moment.";
    return `📊 DERNIER SHIFT\n\nWorker: ${shift.worker?.name || "INCONNU"}\nRecette finale: ${money3(Number(shift.recetteFinale || 0))}\nCash caisse: ${money3(Number(shift.cashCaisse || 0))}\nTicket caisse: ${money3(Number(shift.ticketTotal || 0))}\nCorrections retenues: ${money3(Number(shift.acceptedCorrectionTotal || 0))}\nDépenses: ${money3(Number(shift.expenseTotal || 0))}\nStaff salaire: ${money3(Number(shift.staffSalary || 0))}\nCorrections: ${shift.corrections.length}\nEnregistré: ${(shift.recordedAt || shift.closedAt).toLocaleString("fr-FR")}`;
  }

  const since=new Date(now.getTime()-days*24*60*60*1000);
  if (daysMatch) {
    const shifts=await prisma.shift.findMany({where:{shopId:shop.id,status:"RECORDED",recordedAt:{gte:since}},orderBy:{recordedAt:"desc"}});
    if (!shifts.length) return `📊 Aucun shift enregistré sur les ${days} derniers jours.`;
    const sum=(key:string)=>round3(shifts.reduce((a:any,s:any)=>a+Number(s[key] || 0),0));
    return `📊 RÉSUMÉ — ${days} JOURS\n\nShifts: ${shifts.length}\nRecette totale: ${money3(sum("recetteFinale"))}\nMoyenne / shift: ${money3(sum("recetteFinale")/shifts.length)}\nCash caisse total: ${money3(sum("cashCaisse"))}\nTicket caisse total: ${money3(sum("ticketTotal"))}\nCorrections automatiques: ${money3(sum("automaticCorrectionTotal"))}\nCorrections retenues: ${money3(sum("acceptedCorrectionTotal"))}\nDépenses: ${money3(sum("expenseTotal"))}\nStaff salaires: ${money3(sum("staffSalary"))}`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+STOCK$/.test(cmd)) {
    const items=await prisma.item.findMany({where:{archivedAt:null},orderBy:{name:"asc"}});
    const movements=await prisma.stockMovement.findMany({where:{source:"RECETTE"},orderBy:{createdAt:"desc"},take:8,include:{item:true}});
    return `📦 STOCK ACTUEL\n\n${items.map(i=>`• ${i.name}: ${round3(i.quantity)} ${i.unit}`).join("\n")}\n\nDernières consommations /recette :\n${movements.length?movements.map(m=>`• ${m.item.name}: ${round3(Math.abs(m.quantity))} ${m.item.unit} consommé | ${round3(m.quantityBefore ?? 0)} → ${round3(m.quantityAfter ?? 0)}`).join("\n"):"Aucune."}`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+(?:APPROVISIONNEMENT|APPRO|AJOUTS?|REAPPROVISIONNEMENT)$/.test(cmd)) {
    const since30=new Date(now.getTime()-30*24*60*60*1000);
    const movements=await prisma.stockMovement.findMany({
      where:{type:"IN",source:{in:["MANUAL","CHAT"]},createdAt:{gte:since30},item:{archivedAt:null}},
      include:{item:true},orderBy:{createdAt:"asc"}
    });
    if (!movements.length) return "📥 APPROVISIONNEMENT — 30 JOURS\n\nAucun ajout de stock enregistré sur les 30 derniers jours.";
    const grouped=new Map<string, typeof movements>();
    for (const m of movements) grouped.set(m.itemId,[...(grouped.get(m.itemId)||[]),m]);
    const rows=[...grouped.values()].map(list=>{
      const item=list[0].item;
      const total=round3(list.reduce((a,m)=>a+Number(m.quantity),0));
      const avg=round3(total/list.length);
      const intervals:number[]=[];
      for(let i=1;i<list.length;i++) intervals.push((list[i].createdAt.getTime()-list[i-1].createdAt.getTime())/(24*60*60*1000));
      const avgDays=intervals.length?round3(intervals.reduce((a,v)=>a+v,0)/intervals.length):null;
      const last=list[list.length-1];
      return {item,total,avg,count:list.length,avgDays,last};
    }).sort((a,b)=>b.total-a.total);
    return `📥 APPROVISIONNEMENT — 30 JOURS\n\n${rows.map(r=>`• ${r.item.name}: ${r.count} ajout(s) | +${r.total} ${r.item.unit} au total | moyenne +${r.avg} ${r.item.unit}${r.avgDays!==null?` | rythme ≈ tous les ${r.avgDays} jours`:" | rythme: pas encore calculable"}\n  Dernier ajout: +${round3(r.last.quantity)} ${r.item.unit} le ${r.last.createdAt.toLocaleString("fr-FR")}${r.last.quantityBefore!==null&&r.last.quantityAfter!==null?` | ${round3(r.last.quantityBefore)} → ${round3(r.last.quantityAfter)}`:""}`).join("\n")}`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+CORRECTIONS$/.test(cmd)) {
    const rows=await prisma.shiftCorrection.findMany({where:{shift:{shopId:shop.id,status:"RECORDED",recordedAt:{gte:since}}},orderBy:{createdAt:"desc"}});
    const auto=round3(rows.reduce((a,r)=>a+Number(r.automaticAmount),0)), accepted=round3(rows.reduce((a,r)=>a+Number(r.acceptedAmount),0));
    const rejected=rows.filter(r=>r.decision==="REJECTED").length, modified=rows.filter(r=>r.decision==="MODIFIED").length;
    return `🧾 CORRECTIONS — 7 JOURS\n\nLignes: ${rows.length}\nAutomatique total: ${money3(auto)}\nRetenu total: ${money3(accepted)}\nRejetées: ${rejected}\nModifiées: ${modified}`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+VENTES$/.test(cmd)) {
    const rows=await prisma.shiftSaleLine.groupBy({by:["normalizedProductName"],where:{shift:{shopId:shop.id,status:"RECORDED",recordedAt:{gte:since}}},_sum:{quantity:true},orderBy:{_sum:{quantity:"desc"}},take:10});
    return `🛒 TOP VENTES — 7 JOURS\n\n${rows.length?rows.map((r,i)=>`${i+1}. ${r.normalizedProductName || "INCONNU"}: ${round3(r._sum.quantity || 0)}`).join("\n"):"Aucune vente enregistrée."}`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+(?:CAFE|CAFÉ)$/.test(cmd)) {
    const metrics=await prisma.shiftMetric.findMany({where:{shift:{shopId:shop.id,status:"RECORDED",recordedAt:{gte:since}},metricCode:{in:["COFFEE_SOLD","COFFEE_BEANS_CONSUMED"]}}});
    const sold=round3(metrics.filter(m=>m.metricCode==="COFFEE_SOLD").reduce((a,m)=>a+Number(m.value),0));
    const beans=round3(metrics.filter(m=>m.metricCode==="COFFEE_BEANS_CONSUMED").reduce((a,m)=>a+Number(m.value),0));
    return `☕ CAFÉ — 7 JOURS\n\nCafés vendus: ${sold}\nBeans consommés: ${beans} kg\nRatio global: ${beans>0?round3(sold/beans):"—"} cafés/kg`;
  }

  if (/^\/(?:ANALYSE|ANALYTICS)\s+CHICHA$/.test(cmd)) {
    const metrics=await prisma.shiftMetric.findMany({where:{shift:{shopId:shop.id,status:"RECORDED",recordedAt:{gte:since}},metricCode:{in:["CHICHA_NORMAL","CHICHA_PERSONNEL","TOMBAC_CONSUMED"]}}});
    const normal=round3(metrics.filter(m=>m.metricCode==="CHICHA_NORMAL").reduce((a,m)=>a+Number(m.value),0));
    const personnel=round3(metrics.filter(m=>m.metricCode==="CHICHA_PERSONNEL").reduce((a,m)=>a+Number(m.value),0));
    const tombac=round3(metrics.filter(m=>m.metricCode==="TOMBAC_CONSUMED").reduce((a,m)=>a+Number(m.value),0));
    return `💨 CHICHA — 7 JOURS\n\nChichas normales: ${normal}\nChichas personnel: ${personnel}\nTombac consommé: ${tombac} g\nRatio global: ${normal>0?round3(tombac/normal):"—"} g/chicha normale`;
  }

  return "Commande analyse non reconnue. Envoyez /analyse pour voir les commandes disponibles.";
}

function round3(v:number){ return Math.round((v + Number.EPSILON)*1000)/1000; }
function money3(v:number){ return `${v.toFixed(3)} DT`; }

function normalizeCommand(value: string) {
  let cmd = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ").toUpperCase();
  const aliases: Record<string,string> = {
    "CONFIRME DONNEE":"CONFIRME DONNEES", "CONFIRMER DONNEES":"CONFIRME DONNEES", "CONFIRMER DONNEE":"CONFIRME DONNEES",
    "CONFIRME CORRECTION":"CONFIRME CORRECTIONS", "CONFIRMER CORRECTION":"CONFIRME CORRECTIONS", "CONFIRMER CORRECTIONS":"CONFIRME CORRECTIONS",
    "ACCEPTER TOUT":"ACCEPTE TOUT", "J ACCEPTE TOUT":"ACCEPTE TOUT", "J'ACCEPTE TOUT":"ACCEPTE TOUT",
    "OUI ENREGISTRER":"OUI ENREGISTRE", "ENREGISTRE":"OUI ENREGISTRE", "ENREGISTRER":"OUI ENREGISTRE", "OUI ENREGISTRE LE SHIFT":"OUI ENREGISTRE"
  };
  return aliases[cmd] || cmd;
}

function cleanupRecetteSessions() {
  const now = Date.now();
  for (const [key, value] of recetteSessions) if (now - value.updatedAt > RECETTE_TTL) recetteSessions.delete(key);
}

function cryptoRandomId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }

export default router;
