"use client";

import { useRouter } from "next/navigation";
import AuthGate from "../../../../components/AuthGate";
import { CoffeeIcon, ChevronIcon } from "../../../../components/icons";

export default function AboutPage() {
  const router = useRouter();

  return (
    <AuthGate>
      <div className="app-shell min-h-dvh bg-saraya-bg">
        <header className="flex h-16 items-center border-b border-saraya-border px-5">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[15px] font-medium text-saraya-text" aria-label="Retour">
            <span className="text-[22px] leading-none">←</span>
            <span>À propos</span>
          </button>
        </header>

        <main>
          <section className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex justify-center text-saraya-primary">
              <CoffeeIcon size={40} />
            </div>
            <h1 className="text-[22px] font-semibold text-saraya-text">Saraya Assistant</h1>
            <p className="mt-1 text-[13px] text-saraya-secondary">Version 1.0</p>
            <p className="mx-auto mt-6 max-w-[250px] text-[15px] leading-6 text-saraya-text">
              L'assistant privé pour<br />votre café.
            </p>
          </section>

          <section className="border-t border-saraya-border px-5 py-7">
            <div className="mb-2 text-[11px] uppercase tracking-[0.5px] text-saraya-secondary">Support</div>
            <a href="tel:+21629568436" className="flex h-14 items-center justify-between border-b border-saraya-border">
              <span className="text-[15px] text-saraya-text">Téléphone</span>
              <span className="flex items-center gap-2 text-[13px] text-saraya-secondary">
                +216 29 568 436 <ChevronIcon size={17} />
              </span>
            </a>
          </section>

          <section className="border-t border-saraya-border px-5 py-7">
            <div className="mb-4 text-[11px] uppercase tracking-[0.5px] text-saraya-secondary">Confidentialité</div>
            <p className="text-[14px] leading-6 text-saraya-text">
              Vos données restent les vôtres.<br />
              Aucune donnée n'est partagée.
            </p>
            <p className="mt-5 text-[14px] leading-6 text-saraya-text">
              L'assistant utilise votre propre<br />
              clé OpenAI.
            </p>
          </section>

          <section className="border-t border-saraya-border px-5 py-8 text-[13px] leading-6 text-saraya-secondary">
            <p>© 2026 Saraya Assistant</p>
            <p>Tous droits réservés</p>
            <p className="mt-5">Application privée — usage<br />personnel uniquement.</p>
          </section>
        </main>
      </div>
    </AuthGate>
  );
}
