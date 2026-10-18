"use client";

import { create } from "zustand";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (token: string, user: User) => void;
  hydrate: () => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  setAuth: (token, user) => {
    localStorage.setItem("saraya_token", token);
    set({ token, user, hydrated: true });
  },

  hydrate: () => {
    const token = localStorage.getItem("saraya_token");
    set({ token, hydrated: true });
  },

  logout: () => {
    localStorage.removeItem("saraya_token");
    set({ token: null, user: null, hydrated: true });
  }
}));
