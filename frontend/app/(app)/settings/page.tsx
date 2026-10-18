"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppFrame from "../../../components/AppFrame";
import { api, getApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/store";
import { ChevronIcon, CloseIcon, EyeIcon, EyeOffIcon } from "../../../components/icons";

type OpenAIState = "checking" | "ready" | "missing_key" | "invalid_key" | "no_credit" | "rate_limited" | "model_unavailable" | "unavailable";

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [shopName, setShopName] = useState("Saraya");
  const [hasKey, setHasKey] = useState(false);
  const [openaiState, setOpenAIState] = useState<OpenAIState>("checking");
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    api.get("/shop").then((response) => {
      setShopName(response.data.name || "Saraya");
      setHasKey(Boolean(response.data.hasOpenAIKey));
    }).catch(() => {});

    verifyOpenAI();
  }, []);

  async function verifyOpenAI() {
    setOpenAIState("checking");
    try {
      const response = await api.get("/shop/openai-status", { timeout: 12000 });
      setOpenAIState(response.data.status || "ready");
      setHasKey(true);
    } catch (err: any) {
      const status = err?.response?.data?.status as OpenAIState | undefined;
      setOpenAIState(status || "unavailable");
      if (status === "missing_key" || status === "invalid_key") setHasKey(false);
    }
  }

  async function saveKey() {
    if (!key.trim() || saving) return;
    setSaving(true);
    setMessage("Vérification de la clé API OpenAI…");
    try {
      const response = await api.patch("/shop/openai-key", { key }, { timeout: 15000 });
      setHasKey(true);
      setOpenAIState(response.data.status || "ready");
      setKey("");
      setKeyOpen(false);
      setMessage(response.data.message || "OpenAI connecté.");
      setTimeout(() => setMessage(""), 3500);
    } catch (err: any) {
      const status = err?.response?.data?.status as OpenAIState | undefined;
      if (status) setOpenAIState(status);
      if (err?.code === "ECONNABORTED") {
        setMessage("La vérification prend trop de temps. La fenêtre a été libérée; vérifiez le statut dans quelques secondes.");
        setKeyOpen(false);
        setOpenAIState("unavailable");
        setTimeout(() => verifyOpenAI(), 2500);
      } else {
        setMessage(getApiError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function closePasswordModal() {
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  async function changePassword() {
    if (passwordSaving) return;
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Remplissez tous les champs.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await api.patch("/auth/password", { currentPassword, newPassword });
      closePasswordModal();
      setMessage(response.data.message || "Mot de passe modifié avec succès.");
      setTimeout(() => setMessage(""), 3500);
    } catch (err) {
      setPasswordError(getApiError(err, "Impossible de modifier le mot de passe."));
    } finally {
      setPasswordSaving(false);
    }
  }

  function disconnect() {
    logout();
    router.replace("/login");
  }

  const statusLabel = openaiState === "checking"
    ? "Vérification…"
    : openaiState === "ready"
      ? "Active"
      : openaiState === "no_credit"
        ? "Crédit requis"
        : openaiState === "rate_limited"
          ? "Limite temporaire"
          : openaiState === "model_unavailable"
            ? "Modèle indisponible"
            : openaiState === "missing_key"
              ? "Non configurée"
              : openaiState === "invalid_key"
                ? "Clé invalide"
                : "Indisponible";

  return (
    <AppFrame>
      <div className="px-5 pt-6">
        <h1 className="text-[20px] font-semibold text-saraya-text">Réglages</h1>

        <Section title="Mon café">
          <Row label="Nom" value={shopName} />
        </Section>

        <Section title="Assistant">
          <button onClick={() => setKeyOpen(true)} className="flex h-14 w-full items-center justify-between border-b border-saraya-border text-left">
            <span className="text-[15px] text-saraya-text">Clé OpenAI</span>
            <span className="flex items-center gap-2 text-[13px] text-saraya-secondary">
              {hasKey ? "••••••••" : "Non configurée"} <ChevronIcon size={17} />
            </span>
          </button>
          <Row label="Statut" value={statusLabel} green={openaiState === "ready"} />
        </Section>

        <Section title="Compte">
          <button onClick={() => setPasswordOpen(true)} className="flex h-14 w-full items-center justify-between border-b border-saraya-border text-left">
            <span className="text-[15px] text-saraya-text">Changer le mot de passe</span>
            <span className="text-saraya-secondary"><ChevronIcon size={17} /></span>
          </button>
        </Section>

        <Section title="Aide">
          <button onClick={() => router.push("/settings/guide")} className="flex h-14 w-full items-center justify-between border-b border-saraya-border text-left">
            <span className="text-[15px] text-saraya-text">Guide d'utilisation</span>
            <span className="text-saraya-secondary"><ChevronIcon size={17} /></span>
          </button>
          <button onClick={() => router.push("/settings/about")} className="flex h-14 w-full items-center justify-between border-b border-saraya-border text-left">
            <span className="text-[15px] text-saraya-text">À propos</span>
            <span className="text-saraya-secondary"><ChevronIcon size={17} /></span>
          </button>
        </Section>

        {message && <div className="mt-5 text-center text-[13px] text-saraya-secondary">{message}</div>}

        <button
          onClick={disconnect}
          className="mt-6 h-[52px] w-full rounded-xl border border-saraya-border bg-white text-[15px] font-medium text-saraya-error"
        >
          Se déconnecter
        </button>
      </div>

      {keyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="mx-auto w-full max-w-[480px] rounded-t-[20px] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] font-semibold">Clé OpenAI</h2>
              <button onClick={() => setKeyOpen(false)}><CloseIcon /></button>
            </div>
            <p className="mb-4 text-[13px] leading-5 text-saraya-secondary">
              La clé est vérifiée avec OpenAI avant enregistrement. Le test confirme l'accès API et détecte aussi un crédit ou une limite de dépenses insuffisante.
            </p>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              type="password"
              placeholder="AIza…"
              className="h-12 w-full rounded-xl border border-saraya-border px-4 text-[15px]"
            />
            <button disabled={saving} onClick={saveKey} className="mt-4 h-12 w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50">
              {saving ? "Vérification…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="mx-auto w-full max-w-[480px] rounded-t-[20px] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-saraya-text">Changer le mot de passe</h2>
              <button onClick={closePasswordModal}><CloseIcon /></button>
            </div>

            <PasswordField label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} show={showCurrentPassword} onToggle={() => setShowCurrentPassword((v) => !v)} autoComplete="current-password" />
            <div className="mt-4">
              <PasswordField label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} show={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} autoComplete="new-password" />
            </div>
            <div className="mt-4">
              <PasswordField label="Confirmer le nouveau mot de passe" value={confirmPassword} onChange={setConfirmPassword} show={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} autoComplete="new-password" />
            </div>

            <p className="mt-3 text-[12px] text-saraya-secondary">8 caractères minimum.</p>
            {passwordError && <div className="mt-4 rounded-xl border border-saraya-error bg-[#FEF2F2] px-3 py-3 text-center text-[13px] text-saraya-error">{passwordError}</div>}

            <button
              disabled={passwordSaving}
              onClick={changePassword}
              className="mt-5 h-12 w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {passwordSaving ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </div>
        </div>
      )}
    </AppFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 text-[11px] uppercase tracking-[0.5px] text-saraya-secondary">{title}</div>
      <div className="premium-settings-card">{children}</div>
    </section>
  );
}

function Row({ label, value, green, chevron }: { label: string; value?: string; green?: boolean; chevron?: boolean }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-saraya-border">
      <span className="text-[15px] text-saraya-text">{label}</span>
      <span className={`flex items-center gap-2 text-[13px] ${green ? "text-saraya-primary" : "text-saraya-secondary"}`}>
        {value}
        {chevron && <ChevronIcon size={17} />}
      </span>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-saraya-secondary">{label}</label>
      <div className="relative mt-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-saraya-border bg-white px-4 pr-12 text-[15px] text-saraya-text"
        />
        <button
          type="button"
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-saraya-secondary"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
