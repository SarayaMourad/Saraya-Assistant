"use client";

import { useEffect, useState } from "react";
import AppFrame from "../../../components/AppFrame";
import { api, getApiError } from "../../../lib/api";
import type { Item } from "../../../lib/types";
import { CloseIcon, PlusIcon } from "../../../components/icons";

function todayFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());
}

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      const response = await api.get("/items");
      setItems(response.data);
    } catch (err) {
      setError(getApiError(err, "Impossible de charger le stock."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AppFrame>
      <header className="border-b border-saraya-border px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-medium text-saraya-text">Saraya</span>
          <span className="capitalize text-[13px] text-saraya-secondary">{todayFr()}</span>
        </div>
      </header>

      <section className="px-5 pt-7">
        <div className="mb-2 text-[11px] uppercase tracking-[0.5px] text-saraya-secondary">Stock</div>

        {error && <div className="mb-3 rounded-xl border border-saraya-error bg-[#FEF2F2] p-3 text-[13px] text-saraya-error">{error}</div>}

        <div className="premium-list-card">
          {loading ? (
            <div className="py-8 text-[13px] text-saraya-secondary">Chargement du stock…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-[13px] text-saraya-secondary">Aucun article.</div>
          ) : items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={`flex h-14 w-full items-center justify-between text-left ${
                index < items.length - 1 ? "border-b border-saraya-border" : ""
              }`}
            >
              <span className="text-[15px] font-medium text-saraya-text">{item.name}</span>
              <span>
                <strong className="text-[17px] font-semibold text-saraya-text">{formatQty(item.quantity)}</strong>{" "}
                <span className="text-[13px] text-saraya-secondary">{item.unit}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => setAddStockOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-saraya-primary text-[15px] font-semibold text-white"
          >
            <PlusIcon size={18} /> Ajouter du stock
          </button>
          <button
            onClick={() => setAddItemOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-saraya-border bg-white text-[15px] font-medium text-saraya-text"
          >
            <PlusIcon size={18} /> Ajouter un article
          </button>
        </div>
      </section>

      {selected && (
        <EditItemSheet
          item={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}

      {addStockOpen && (
        <AddStockSheet
          items={items}
          onClose={() => setAddStockOpen(false)}
          onDone={() => { setAddStockOpen(false); load(); }}
        />
      )}

      {addItemOpen && (
        <AddItemSheet
          onClose={() => setAddItemOpen(false)}
          onDone={() => { setAddItemOpen(false); load(); }}
        />
      )}
    </AppFrame>
  );
}

function formatQty(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="mx-auto w-full max-w-[480px] rounded-t-[20px] bg-white p-6 fade-in">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold text-saraya-text">{title}</h2>
          <button onClick={onClose} className="text-saraya-secondary"><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", unit }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; unit?: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[12px] font-medium text-saraya-secondary">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-saraya-border bg-white px-4 pr-14 text-[15px] text-saraya-text"
        />
        {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-saraya-secondary">{unit}</span>}
      </div>
    </label>
  );
}

function EditItemSheet({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const plus = Number(add || 0);
    const minus = Number(remove || 0);
    if (plus < 0 || minus < 0 || plus - minus + item.quantity < 0) {
      setError("La quantité est invalide.");
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/items/${item.id}`, { quantity: item.quantity + plus - minus });
      onDone();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm(`Supprimer ${item.name} ?`)) return;
    setBusy(true);
    try {
      await api.delete(`/items/${item.id}`);
      onDone();
    } catch (err) {
      setError(getApiError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Modifier ${item.name}`} onClose={onClose}>
      <Field label="Ajouter" value={add} onChange={setAdd} type="number" unit={item.unit} />
      <Field label="Retirer" value={remove} onChange={setRemove} type="number" unit={item.unit} />
      {error && <div className="mb-4 text-[13px] text-saraya-error">{error}</div>}
      <button onClick={archive} className="mb-5 text-[13px] text-saraya-error">Supprimer cet article</button>
      <button disabled={busy} onClick={save} className="h-12 w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50">
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </Sheet>
  );
}

function AddStockSheet({ items, onClose, onDone }: { items: Item[]; onClose: () => void; onDone: () => void }) {
  const [itemId, setItemId] = useState(items[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = items.find((i) => i.id === itemId);

  async function submit() {
    const qty = Number(quantity);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      setError("Saisissez une quantité valide.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/items/${itemId}/stock`, { quantity: qty });
      onDone();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Ajouter du stock" onClose={onClose}>
      <label className="mb-4 block">
        <span className="mb-1 block text-[12px] font-medium text-saraya-secondary">Article</span>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="h-12 w-full rounded-xl border border-saraya-border bg-white px-4 text-[15px]">
          {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <Field label="Quantité" value={quantity} onChange={setQuantity} type="number" unit={selected?.unit} />
      {error && <div className="mb-4 text-[13px] text-saraya-error">{error}</div>}
      <button disabled={busy} onClick={submit} className="h-12 w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50">
        {busy ? "Ajout…" : "Ajouter au stock"}
      </button>
    </Sheet>
  );
}

function AddItemSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim() || !unit.trim()) {
      setError("Le nom et l'unité sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/items", { name, unit });
      onDone();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Ajouter un article" onClose={onClose}>
      <Field label="Nom de l'article" value={name} onChange={setName} placeholder="Ex: Lait" />
      <Field label="Unité" value={unit} onChange={setUnit} placeholder="Ex: L, kg, pcs, g" />
      {error && <div className="mb-4 text-[13px] text-saraya-error">{error}</div>}
      <button disabled={busy} onClick={submit} className="h-12 w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50">
        {busy ? "Création…" : "Créer l'article"}
      </button>
    </Sheet>
  );
}
