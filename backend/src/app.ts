import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import itemsRouter from "./routes/items";
import shiftsRouter from "./routes/shifts";
import chatRouter from "./routes/chat";
import shopRouter from "./routes/shop";
import { requireAuth } from "./lib/auth";

export const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL?.split(",").map((x) => x.trim()) || "http://localhost:3000",
  credentials: false
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "saraya-assistant" });
});

app.use("/auth", authRouter);
app.use("/items", requireAuth, itemsRouter);
app.use("/shifts", requireAuth, shiftsRouter);
app.use("/chat", requireAuth, chatRouter);
app.use("/shop", requireAuth, shopRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Une erreur serveur est survenue." });
});
