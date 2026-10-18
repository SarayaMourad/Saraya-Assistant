"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import AppFrame from "../../../components/AppFrame";
import { api, getApiError } from "../../../lib/api";
import { ArrowIcon, CloseIcon, PaperclipIcon, PlusIcon } from "../../../components/icons";
import type { ChatMessage } from "../../../lib/types";

const CHAT_STORAGE_KEY = "saraya-assistant-chat-v1";
const CHAT_TTL_MS = 30 * 60 * 1000;

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Bonjour Mourad. Envoyez-moi des photos ou posez une question."
};

const suggestions = [
  "/recette",
  "Ajouter du stock",
  "Combien de lait me reste ?",
  "Analyse de la semaine"
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [text, setText] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, previews]);

  // Keep the conversation available for 30 minutes after the last activity.
  // Image object URLs are intentionally not persisted because they are only valid
  // for the current browser session; the text conversation is restored safely.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { updatedAt?: number; messages?: ChatMessage[] };
        if (saved.updatedAt && Date.now() - saved.updatedAt <= CHAT_TTL_MS && Array.isArray(saved.messages) && saved.messages.length) {
          setMessages(saved.messages);
        } else {
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } finally {
      setChatLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!chatLoaded) return;
    const safeMessages = messages.map(({ imageUrl, imageUrls, ...message }) => message);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ updatedAt: Date.now(), messages: safeMessages }));
  }, [messages, chatLoaded]);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []).filter((f) => f.type.startsWith("image/"));
    const available = Math.max(0, 2 - selectedImages.length);
    const filesToAdd = incoming.slice(0, available);
    if (filesToAdd.length) {
      setSelectedImages((current) => [...current, ...filesToAdd].slice(0, 2));
      setPreviews((current) => [...current, ...filesToAdd.map((f) => URL.createObjectURL(f))].slice(0, 2));
    }
    event.target.value = "";
  }

  function removeImage(index: number) {
    setPreviews((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target);
      return current.filter((_, i) => i !== index);
    });
    setSelectedImages((current) => current.filter((_, i) => i !== index));
  }

  function removeImages() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setPreviews([]);
  }

  async function send(customText?: string) {
    const message = customText ?? text;
    if ((!message.trim() && selectedImages.length === 0) || busy) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message || "Photos de feuille de shift",
      imageUrl: previews[0],
      imageUrls: [...previews],
      filename: selectedImages[0]?.name,
      filenames: selectedImages.map((file) => file.name)
    };

    setMessages((current) => [...current, userMessage]);
    setText("");
    setBusy(true);

    try {
      const form = new FormData();
      form.append("message", message);
      form.append("history", JSON.stringify(
        messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }))
      ));
      selectedImages.forEach((file) => form.append("images", file));

      const response = await api.post("/chat", form);
      const data = response.data;

      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          source: data.source,
          actionId: data.actionId,
          preview: data.preview,
          requiresConfirmation: data.requiresConfirmation,
          recetteState: data.recetteState,
          recetteData: data.recetteData,
          recetteCalculations: data.recetteCalculations,
          recetteFinal: data.recetteFinal,
          shiftId: data.shiftId
        }
      ]);

      removeImages();
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: getApiError(err, "L'assistant est momentanément indisponible.")
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  async function confirm(actionId: string) {
    try {
      setBusy(true);
      const response = await api.post("/chat/confirm", { actionId });
      setMessages((current) => [
        ...current.map((m) => m.actionId === actionId ? { ...m, requiresConfirmation: false } : m),
        {
          id: `confirm-${Date.now()}`,
          role: "assistant",
          content: response.data.answer
        }
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { id: `e-${Date.now()}`, role: "assistant", content: getApiError(err) }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(actionId: string) {
    try {
      await api.post("/chat/cancel", { actionId });
    } finally {
      setMessages((current) => current.map((m) => m.actionId === actionId ? { ...m, requiresConfirmation: false } : m));
    }
  }

  return (
    <AppFrame>
      <header className="assistant-header sticky top-0 z-10 border-b border-saraya-border/80 bg-white/85 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-medium text-saraya-text">Assistant Saraya</span>
          <span className="flex items-center gap-2 text-[13px] text-saraya-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-saraya-primary" />
            En ligne
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="h-[calc(100dvh-145px)] overflow-y-auto px-5 pb-32 pt-6">
        {messages.map((message) => (
          <div key={message.id} className={`mb-5 ${message.role === "user" ? "flex justify-end" : ""}`}>
            <div className={message.role === "user" ? "max-w-[80%]" : "max-w-[88%]"}>
              {(message.imageUrls?.length ? message.imageUrls : message.imageUrl ? [message.imageUrl] : []).length > 0 && (
                <div className="mb-2 flex max-w-[220px] gap-2">
                  {(message.imageUrls?.length ? message.imageUrls : [message.imageUrl!]).map((src, index) => (
                    <div key={`${message.id}-img-${index}`} className="min-w-0">
                      <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
                      <div className="mt-1 truncate text-[11px] text-saraya-secondary">
                        {message.filenames?.[index] || (index === 0 ? message.filename : `Photo ${index + 1}`)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {message.role === "assistant" && message.recetteState ? (
                <RecetteMessage message={message} onCommand={send} busy={busy} />
              ) : (
                <div className={message.role === "user"
                  ? "message-user"
                  : "message-assistant"}
                >
                  <ReadableText text={message.content} />
                </div>
              )}

              {message.source && (
                <div className="mt-1 text-[12px] italic text-saraya-secondary">Source : {message.source}</div>
              )}

              {message.requiresConfirmation && message.actionId && (
                <div className="mt-3">
                  {message.preview && <div className="mb-2 text-[13px] text-saraya-secondary">{message.preview}</div>}
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => confirm(message.actionId!)}
                      className="rounded-[10px] bg-saraya-primary px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => cancel(message.actionId!)}
                      className="rounded-[10px] border border-saraya-border bg-white px-5 py-2.5 text-[13px] text-saraya-text"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-[13px] text-saraya-secondary">Traitement…</div>}
      </div>

      <div className="composer chat-composer fixed bottom-0 z-20 w-full px-4 pb-[76px] pt-3">
        {previews.length > 0 && (
          <div className="mb-2 flex gap-2">
            {previews.map((src, index) => (
              <div key={src} className="relative">
                <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-white text-saraya-text"
                  aria-label={`Retirer la photo ${index + 1}`}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={selectedImages.length >= 2}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-saraya-border bg-white text-saraya-text disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={selectedImages.length >= 2 ? "Maximum 2 photos" : "Ajouter une photo"}
          >
            <PlusIcon />
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Écrivez ou envoyez une photo…"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-saraya-border bg-white px-4 text-[15px] shadow-sm"
          />
          <button
            disabled={busy || (!text.trim() && selectedImages.length === 0)}
            onClick={() => send()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-saraya-primary text-white disabled:opacity-50"
            aria-label="Envoyer"
          >
            <ArrowIcon />
          </button>
        </div>
      </div>
    </AppFrame>
  );
}


function ReadableText({ text }: { text: string }) {
  // Defensive cleanup for model/provider rendering artifacts (e.g. a dangling "svg" token).
  const clean = text
    .replace(/\\<|\\>/g, "")
    .replace(/^\s*svg\s*$/gim, "")
    .replace(/<\/?svg\b[^>]*>/gi, "")
    .trim();
  const parts = clean.split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-ÝÉÈÊÇ])/).map(x => x.trim()).filter(Boolean);
  return <div className="readable-text">{parts.map((part, i) => <p key={i}>{part}</p>)}</div>;
}

function Money({ value, sign = false }: { value: number | null | undefined; sign?: boolean }) {
  if (value == null) return <>—</>;
  const prefix = sign && value > 0 ? "+" : "";
  return <>{prefix}{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value)} DT</>;
}

function RecetteMessage({ message, onCommand, busy }: { message: ChatMessage; onCommand: (text: string) => void; busy: boolean }) {
  const d = message.recetteData;
  const c = message.recetteCalculations;
  const f = message.recetteFinal;
  const state = message.recetteState;
  const steps = ["Documents", "Vérification", "Corrections", "Recette", "Enregistré"];
  const active = state === "REVIEW_DATA" ? 1 : state === "REVIEW_CORRECTIONS" ? 2 : state === "READY_TO_RECORD" ? 3 : 4;
  return <div className="recette-card">
    <div className="recette-head"><div><span className="eyebrow">/recette</span><h3>{state === "RECORDED" ? "Shift enregistré" : state === "READY_TO_RECORD" ? "Recette prête" : state === "REVIEW_CORRECTIONS" ? "Corrections" : "Données extraites"}</h3></div><span className={`status-pill ${state === "RECORDED" ? "done" : ""}`}>{state === "RECORDED" ? "Terminé" : "À vérifier"}</span></div>
    <div className="stepper">{steps.map((x,i)=><div key={x} className={`step ${i<=active?"active":""}`}><span>{i<active?"✓":i+1}</span><small>{x}</small></div>)}</div>
    {state === "REVIEW_DATA" && d && <>
      <div className="metric-grid">
        <Metric label="Caisse" value={<Money value={d.stock?.cashCaisse}/>} />
        <Metric label="Ticket" value={<Money value={d.ticket?.ticketTotal}/>} />
        <Metric label="Dépenses" value={<Money value={d.stock?.depense}/>} />
        <Metric label="Salaire staff" value={<Money value={d.stock?.staffSalaire}/>} />
        <Metric label="Rami Games" value={String(d.stock?.ramiGames ?? "—")} />
      </div>
      <SectionTitle title="Stock" subtitle={`${d.stock?.lines?.length || 0} articles détectés`} />
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Article</th><th>Début</th><th>Ajout</th><th>Fin</th></tr></thead><tbody>{d.stock?.lines?.map((x:any)=><tr key={x.item}><td><b>{x.item}</b><small>{x.unit || ""}</small></td><td>{x.start ?? "—"}</td><td>{x.ajout ?? "—"}</td><td>{x.fin ?? "—"}</td></tr>)}</tbody></table></div>
      <SectionTitle title="Ticket caisse" subtitle={`${d.ticket?.lines?.length || 0} lignes`} />
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead><tbody>{d.ticket?.lines?.map((x:any,i:number)=><tr key={`${x.product}-${i}`}><td><b>{x.product}</b><small>{x.category || ""}</small></td><td>{x.qte ?? "—"}</td><td><Money value={x.unitPrice}/></td><td><Money value={x.total}/></td></tr>)}</tbody></table></div>
    </>}
    {state === "REVIEW_CORRECTIONS" && c && <>
      <div className="hero-total"><span>Total corrections retenues</span><strong><Money value={c.acceptedCorrectionTotal} sign/></strong></div>
      <div className="table-wrap"><table className="data-table corrections"><thead><tr><th>Article</th><th>Réel</th><th>Attendu</th><th>Écart</th><th>Correction</th></tr></thead><tbody>{c.corrections?.map((x:any)=><tr key={x.code} className={x.difference===0?"quiet":""}><td><b>{x.label}</b><small>{decisionLabel(x.decision)}</small></td><td>{x.actual}</td><td>{x.expected}</td><td>{x.difference>0?"+":""}{x.difference}</td><td><Money value={x.acceptedAmount} sign/></td></tr>)}</tbody></table></div>
      <div className="insight-grid"><Metric label="Cafés servis" value={String(c.coffee?.soldCoffees ?? "—")} sub={c.coffee?.beansConsumed != null ? `${c.coffee.beansConsumed} g de grains` : undefined}/><Metric label="Chichas servies" value={String(c.chicha?.total ?? "—")} sub={c.chicha?.tombacConsumed != null ? `${c.chicha.tombacConsumed} g de tombac` : undefined}/></div>
    </>}
    {(state === "READY_TO_RECORD" || state === "RECORDED") && f && <>
      <div className="final-total"><span>Recette finale</span><strong><Money value={f.recetteFinale}/></strong></div>
      <div className="ledger"><Ledger label="Cash caisse" value={f.cashCaisse}/><Ledger label={`Rami Games (${f.ramiGames} × ${f.ramiMultiplier?.toFixed?.(3) || f.ramiMultiplier} DT)`} value={f.ramiValue} sign/><Ledger label="Corrections" value={f.acceptedCorrectionTotal} sign/><Ledger label="Dépenses" value={-f.depense} sign/><Ledger label="Salaire" value={-f.staffSalaire} sign/><Ledger label="Ticket caisse" value={f.ticketTotal} muted/></div>
      {state === "RECORDED" && <div className="success-panel"><b>Tout est enregistré.</b><span>Stock, ventes, corrections et audit ont été sauvegardés dans PostgreSQL.</span>{message.shiftId && <small>Référence · {message.shiftId}</small>}</div>}
    </>}
    <div className="recette-note"><ReadableText text={message.content}/></div>
    {state !== "RECORDED" && <div className="recette-actions">
      {state === "REVIEW_DATA" && <button disabled={busy} onClick={() => onCommand("CONFIRME DONNÉES")} className="premium-button primary">Confirmer les données</button>}
      {state === "REVIEW_CORRECTIONS" && <>
        <button disabled={busy} onClick={() => onCommand("ACCEPTE TOUT")} className="premium-button secondary">Accepter tout</button>
        <button disabled={busy} onClick={() => onCommand("CONFIRME CORRECTIONS")} className="premium-button primary">Confirmer les corrections</button>
      </>}
      {state === "READY_TO_RECORD" && <button disabled={busy} onClick={() => onCommand("OUI ENREGISTRE")} className="premium-button primary">Enregistrer le shift</button>}
    </div>}
  </div>;
}
function Metric({label,value,sub}:{label:string;value:React.ReactNode;sub?:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}
function SectionTitle({title,subtitle}:{title:string;subtitle?:string}){return <div className="section-title"><h4>{title}</h4>{subtitle&&<span>{subtitle}</span>}</div>}
function Ledger({label,value,sign,muted}:{label:string;value:number;sign?:boolean;muted?:boolean}){return <div className={`ledger-row ${muted?"muted":""}`}><span>{label}</span><b><Money value={value} sign={sign}/></b></div>}
function decisionLabel(x:string){return x==="ACCEPTED"?"Acceptée":x==="REJECTED"?"Rejetée":x==="MODIFIED"?"Modifiée":"En attente"}
