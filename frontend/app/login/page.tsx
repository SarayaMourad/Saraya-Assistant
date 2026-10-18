"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getApiError } from "../../lib/api";
import { useAuth } from "../../lib/store";
import { CoffeeIcon, EyeIcon, EyeOffIcon } from "../../components/icons";

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth, hydrated, hydrate } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => hydrate(), [hydrate]);

  useEffect(() => {
    if (hydrated && token) router.replace("/stock");
  }, [hydrated, token, router]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      setAuth(response.data.token, response.data.user);
      router.replace("/stock");
    } catch (err) {
      setError(getApiError(err, "Email ou mot de passe incorrect"));
      window.setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-saraya-bg px-8">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] items-center justify-center">
        <div className="w-full">
          <div className="text-center">
            <div className="mx-auto mb-2 flex justify-center text-saraya-primary"><CoffeeIcon /></div>
            <div className="text-[24px] font-semibold text-saraya-text">Saraya</div>
            <div className="text-[13px] text-saraya-secondary">Assistant privé</div>
          </div>

          <form onSubmit={login} className="mt-8">
            <label className="block text-[12px] font-medium text-saraya-secondary">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              className="mt-1 h-12 w-full rounded-xl border border-saraya-border bg-white px-4 text-[15px] text-saraya-text"
            />

            <label className="mt-4 block text-[12px] font-medium text-saraya-secondary">Mot de passe</label>
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-saraya-border bg-white px-4 pr-12 text-[15px] text-saraya-text"
                onKeyDown={(e) => {
                  if (e.key === "Enter") login(e);
                }}
              />
              <button
                type="button"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-saraya-secondary"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className="mt-3 text-center text-[13px] text-saraya-secondary">
              Contact : <a href="tel:+21629568436" className="font-medium text-saraya-primary">+216 29 568 436</a>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-saraya-error bg-[#FEF2F2] px-3 py-3 text-center text-[13px] text-saraya-error">
                {error}
              </div>
            )}

            <button
              disabled={!email || !password || loading}
              className="mt-6 h-[52px] w-full rounded-xl bg-saraya-primary text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>

            <div className="mt-3 text-center text-[12px] text-saraya-secondary">Version 1.0</div>
          </form>
        </div>
      </div>
    </div>
  );
}
