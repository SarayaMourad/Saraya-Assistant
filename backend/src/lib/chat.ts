import OpenAI from "openai";
import { prisma } from "./prisma";
import { analyticsToolDefinitions, executeAnalyticsTool } from "./analyticsTools";
import { ChatAction } from "../types";

const SYSTEM_PROMPT = `Vous êtes "Saraya Assistant", l'assistant privé du propriétaire du café Saraya en Tunisie.

LANGUE : Français. Direct. Adressez-vous au propriétaire avec "vous". Pour une question simple, soyez bref. Pour une demande d'analyse, donnez une vraie analyse structurée et suffisamment détaillée pour aider le propriétaire à décider; ne vous limitez pas à 3 phrases.

RÔLE :
- Répondre aux questions sur son entreprise à partir des outils contrôlés Saraya.
- Pour toute question analytique (shift, ventes, stock, café, chicha, consommation, comparaison), APPELEZ un ou plusieurs outils analytics avant de répondre.
- Si le propriétaire demande une analyse générale du dernier shift, utilisez analyse_last_shift_expert: ne répondez jamais avec seulement recette/ticket/café/chicha.
- Analysez les relations entre les faits fournis: volumes, consommations, ratios, corrections, caisse et ventes. Faites ressortir ce qui mérite attention et pourquoi, sans inventer de cause.
- Prendre des actions quand il le demande : ajouter du stock, créer un article, modifier/archiver un article, clôturer un shift.
- Donner une analyse simple quand il demande un conseil.

RÈGLES :
- Ne jamais inventer de nombres.
- Si les outils ne fournissent pas l'information : "Je n'ai pas cette information."
- Ne transformez jamais une correction de stock en chiffre d'affaires ou en performance d'une équipe.
- Distinguez quantité servie, chiffre d'affaires, consommation et correction.
- Une cause d'écart non prouvée doit être formulée comme hypothèse, jamais comme fait.
- DISCIPLINE DE PREUVE : distinguez explicitement (1) FAIT = directement fourni/calculé par Saraya, (2) INTERPRÉTATION = conclusion prudente tirée de plusieurs faits, (3) EXPÉRIENCE À TESTER = suggestion commerciale/opérationnelle non prouvée.
- N'inventez jamais marge, coût matière, bénéfice, comportement client, occupation des tables, heures creuses, préférence client ou cause d'un écart si ces données ne sont pas fournies.
- Ne dites jamais qu'un produit est « à forte marge » sans données de coût. Dites plutôt ce que les données prouvent (ex. chiffre ticket, quantité, part du ticket).
- Si une donnée nécessaire manque, dites précisément laquelle manque et ce qu'elle permettrait de calculer.
- Quand un historique comparable est fourni, comparez le dernier shift à la référence historique et signalez les ratios inhabituels calculés par le backend. N'inventez pas de seuil.
- Les recommandations non directement démontrées par les données doivent être présentées comme des expériences à tester, avec une mesure de succès observable.
- Pour toute modification de base de données, utilisez une fonction.
- Ne prétendez jamais que la modification est déjà faite.
- La confirmation est gérée par le serveur.
- Ne donnez pas de conseil juridique, médical ou fiscal.
- Si une réponse utilise des données, ajoutez à la fin : "Source : données Saraya."
- Si la réponse est un nombre, commencez par lui.
- Si c'est une comparaison, indiquez les deux nombres.
- Si c'est un conseil, donnez une recommandation et une raison.
- Ne dites jamais "en tant qu'IA".

Les données historiques ne sont pas injectées dans le prompt : utilisez les outils analytics.
`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "add_stock", description: "Ajouter du stock à un article existant.", parameters: { type: "object", properties: { itemId: { type: "string" }, quantity: { type: "number", minimum: 0.000001 }, note: { type: ["string", "null"] } }, required: ["itemId", "quantity", "note"], additionalProperties: false } } },
  { type: "function", function: { name: "add_item", description: "Créer un nouvel article.", parameters: { type: "object", properties: { name: { type: "string" }, unit: { type: "string" }, initialQuantity: { type: ["number", "null"], minimum: 0 } }, required: ["name", "unit", "initialQuantity"], additionalProperties: false } } },
  { type: "function", function: { name: "update_item", description: "Modifier un article ou ajuster sa quantité.", parameters: { type: "object", properties: { itemId: { type: "string" }, name: { type: ["string", "null"] }, unit: { type: ["string", "null"] }, quantityDelta: { type: ["number", "null"] } }, required: ["itemId", "name", "unit", "quantityDelta"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_item", description: "Archiver un article.", parameters: { type: "object", properties: { itemId: { type: "string" } }, required: ["itemId"], additionalProperties: false } } },
  { type: "function", function: { name: "close_shift", description: "Clôturer un shift avec caisse et consommation.", parameters: { type: "object", properties: { shiftType: { type: "string", enum: ["MORNING", "EVENING"] }, cashExpected: { type: "number" }, cashCounted: { type: "number" }, consumed: { type: "array", items: { type: "object", properties: { itemId: { type: "string" }, quantity: { type: "number", minimum: 0 } }, required: ["itemId", "quantity"], additionalProperties: false } }, notes: { type: ["string", "null"] } }, required: ["shiftType", "cashExpected", "cashCounted", "consumed", "notes"], additionalProperties: false } } },
  ...analyticsToolDefinitions
];

function parseFunctionCall(
  name: string,
  argumentsJson: string
): ChatAction {
  const data = JSON.parse(argumentsJson);

  if (
    ![
      "add_stock",
      "add_item",
      "update_item",
      "delete_item",
      "close_shift"
    ].includes(name)
  ) {
    throw new Error("Action IA non supportée");
  }

  return {
    type: name as ChatAction["type"],
    data
  } as ChatAction;
}

function isBroadLastShiftAnalysis(message:string){
  const t=message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const last=/(dernier|last|recent).*(shift|service)|(?:shift|service).*(dernier|last|recent)/.test(t);
  const analytical=/(analyse|analyze|analysis|expert|attention|passe|happen|resume|summary|performance|diagnostic)/.test(t);
  return last && analytical;
}

function expertFallback(f:any){
  if(!f?.found) return "Je n'ai pas cette information.";
  const money=(v:any)=>`${Number(v||0).toFixed(3)} DT`;
  const top=(f.corrections?.largest||[]).filter((x:any)=>Math.abs(Number(x.acceptedAmount||0))>0).slice(0,3);
  const lines=[
    `Le dernier shift a clôturé à ${money(f.finance.recetteFinale)}. Le ticket caisse est de ${money(f.finance.ticketTotal)} et les corrections retenues totalisent ${money(f.finance.acceptedCorrections)}.`,
    `Café : ${f.cafe.sold} servi(s), ${f.cafe.beansConsumed} g consommés${f.cafe.gramsPerCoffee!=null?`, soit ${f.cafe.gramsPerCoffee} g par café`:""}. Chicha : ${f.chicha.total} au total, dont ${f.chicha.personnel} personnel, avec ${f.chicha.tombacConsumed} g de tombac${f.chicha.gramsPerNormalChicha!=null?`, soit ${f.chicha.gramsPerNormalChicha} g par chicha normale`:""}.`
  ];
  if(top.length) lines.push(`À vérifier en priorité : ${top.map((x:any)=>`${x.item} (${money(x.acceptedAmount)})`).join(", ")}. Ces écarts sont constatés par les données; leur cause n'est pas prouvée.`);
  lines.push("Source : données Saraya.");
  return lines.join("\n\n");
}

async function runExpertLastShift(client:OpenAI){
  const facts=await executeAnalyticsTool("analyse_last_shift_expert",{});
  if(!facts?.found) return {answer:"Je n'ai pas cette information.",action:null,preview:null};
  const prompt=`Vous êtes l'analyste opérationnel du propriétaire du café Saraya. Voici un dossier DÉTERMINISTE construit par le backend.\n\n${JSON.stringify(facts)}\n\nRÈGLE ABSOLUE : utilisez uniquement les faits et métriques présents dans ce dossier. Ne complétez jamais avec une supposition commerciale.\n\nPour chaque conclusion, appliquez cette discipline :\n- FAIT : donnée directement présente/calculée par Saraya.\n- INTERPRÉTATION : conclusion prudente permise par les faits; utilisez « indique », « suggère », « mérite de vérifier ».\n- EXPÉRIENCE À TESTER : recommandation non prouvée; présentez-la comme un test, jamais comme une certitude.\n\nInterdictions : inventer marge, coût matière, bénéfice, cause d'écart, comportement/préférence client, heures creuses, occupation ou potentiel commercial. Si ces informations manquent, dites-le. Ne transformez jamais une correction en chiffre d'affaires.\n\nUtilisez historicalReference et anomalies lorsqu'ils existent : comparez le dernier shift aux shifts précédents et mettez en avant les ratios réellement inhabituels détectés par le backend. N'inventez aucun seuil.\n\nStructure : 1) Faits clés, 2) Comparaison historique et anomalies, 3) Ce qui mérite vérification, 4) Informations manquantes importantes, 5) au maximum 3 expériences à tester si elles sont pertinentes, avec une métrique de succès. Ne félicitez pas et ne donnez pas de score. Terminez exactement par "Source : données Saraya."`;
  try{
    const response=await client.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",messages:[{role:"system",content:"Vous interprétez des faits Saraya calculés par le backend. Aucun nombre ne doit être inventé."},{role:"user",content:prompt}],temperature:0.1});
    return {answer:response.choices[0]?.message?.content?.trim()||expertFallback(facts),action:null,preview:null};
  }catch(error:any){
    console.warn("EXPERT ANALYSIS OPENAI FALLBACK",error?.message||error);
    return {answer:expertFallback(facts),action:null,preview:null};
  }
}

export async function runTextChat(
  client: OpenAI,
  message: string,
  history: { role: "user" | "assistant"; content: string }[]
) {
  // Broad "analyse last shift" requests always receive the complete deterministic shift dossier first.
  // OpenAI remains the interpreter; PostgreSQL/backend remain the source of truth.
  if (isBroadLastShiftAnalysis(message)) return runExpertLastShift(client);

  const historyMessages = history.slice(-10).map(m => ({ role: m.role, content: m.content } as const));
  // Minimal operational catalogue is kept only so write-actions can target stable item IDs.
  // Historical/analytical data is NOT dumped here; OpenAI must request it through analytics tools.
  const operationalItems=await prisma.item.findMany({where:{archivedAt:null},select:{id:true,name:true,unit:true}});
  const operationalContext=`CATALOGUE ACTIONS (identifiants techniques):\n${operationalItems.map(i=>`- ${i.name} | id=${i.id} | unité=${i.unit}`).join("\n")}`;
  const messages: any[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${operationalContext}` },
    ...historyMessages,
    { role: "user", content: message }
  ];

  try {
    // Up to 4 tool rounds lets OpenAI combine e.g. café + chicha for a comparison.
    for (let round = 0; round < 4; round++) {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages, tools, tool_choice: "auto", temperature: 0.15
      });
      const choice:any = response.choices[0]?.message;
      const calls:any[] = choice?.tool_calls || [];
      if (!calls.length) return { answer: choice?.content || "Je n'ai pas cette information.", action: null, preview: null };
      messages.push(choice);
      for (const call of calls) {
        const fn = call.function;
        if (analyticsToolDefinitions.some((t:any)=>t.function.name===fn.name)) {
          let args:any={}; try { args=JSON.parse(fn.arguments||"{}"); } catch {}
          const facts=await executeAnalyticsTool(fn.name,args);
          messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(facts)});
          continue;
        }
        const action=parseFunctionCall(fn.name,fn.arguments);
        if ("itemId" in action.data) {
          const item=await prisma.item.findFirst({where:{id:action.data.itemId,archivedAt:null}});
          if(!item) throw new Error("L'article sélectionné n'existe plus.");
        }
        const preview=await buildActionPreview(action);
        return {answer:choice?.content||"Je vous propose cette modification :",action,preview};
      }
    }
    return {answer:"Je n'ai pas cette information.",action:null,preview:null};
  } catch (error:any) {
    console.error("OPENAI CHAT ERROR:",{message:error?.message,status:error?.status,code:error?.code,type:error?.type,param:error?.param});
    throw error;
  }
}

async function buildActionPreview(
  action: ChatAction
) {
  switch (action.type) {
    case "add_stock": {
      const item =
        await prisma.item.findUnique({
          where: {
            id: action.data.itemId
          }
        });

      return `Ajouter ${
        action.data.quantity
      } ${
        item?.unit || ""
      } à ${
        item?.name || "l'article"
      }.`;
    }

    case "add_item": {
      const quantityText =
        action.data.initialQuantity !== undefined &&
        action.data.initialQuantity !== null
          ? ` avec ${action.data.initialQuantity} en stock`
          : "";

      return `Créer l'article "${action.data.name}" en ${action.data.unit}${quantityText}.`;
    }

    case "update_item": {
      const item =
        await prisma.item.findUnique({
          where: {
            id: action.data.itemId
          }
        });

      const quantityDelta =
        action.data.quantityDelta;

      const quantityText =
        quantityDelta !== undefined &&
        quantityDelta !== null
          ? ` de ${
              quantityDelta > 0 ? "+" : ""
            }${quantityDelta} ${
              item?.unit || ""
            }`
          : "";

      return `Modifier "${
        item?.name || "article"
      }"${quantityText}.`;
    }

    case "delete_item": {
      const item =
        await prisma.item.findUnique({
          where: {
            id: action.data.itemId
          }
        });

      return `Archiver "${
        item?.name || "article"
      }".`;
    }

    case "close_shift": {
      return `Clôturer le shift ${
        action.data.shiftType === "MORNING"
          ? "du matin"
          : "du soir"
      } avec ${action.data.cashCounted.toFixed(
        2
      )} DT comptés et ${
        action.data.consumed.length
      } article(s) consommé(s).`;
    }
  }
}