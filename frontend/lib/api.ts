import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("saraya_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiError(error: unknown, fallback = "Une erreur est survenue.") {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || fallback;
  }
  return fallback;
}
