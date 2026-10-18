"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/store";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, hydrated, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return <div className="app-shell flex min-h-dvh items-center justify-center text-[13px] text-saraya-secondary">Chargement…</div>;
  }

  return <>{children}</>;
}
