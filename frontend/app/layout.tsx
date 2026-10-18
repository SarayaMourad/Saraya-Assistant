import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saraya Assistant",
  description: "Assistant privé du café Saraya",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
