import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifyOpenAIAccess } from "../lib/openai";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const shop = await prisma.shop.findFirst();
    res.json({
      id: shop?.id,
      name: shop?.name || "Saraya",
      hasOpenAIKey: Boolean((shop?.openaiKey?.startsWith("sk-") && shop.openaiKey.trim()) || process.env.OPENAI_API_KEY?.trim())
    });
  } catch {
    res.status(500).json({ error: "Impossible de charger les réglages." });
  }
});

router.get("/openai-status", async (_req, res) => {
  try {
    const shop = await prisma.shop.findFirst();
    const result = await verifyOpenAIAccess(process.env.OPENAI_API_KEY?.trim() || (shop?.openaiKey?.startsWith("sk-") ? shop.openaiKey : undefined));
    res.status(result.ok ? 200 : 400).json(result);
  } catch {
    res.status(500).json({
      ok: false,
      status: "unavailable",
      message: "Impossible de vérifier OpenAI pour le moment."
    });
  }
});

router.patch("/openai-key", async (req, res) => {
  try {
    const body = z.object({
      key: z.string().trim().startsWith("sk-").min(20).max(500)
    }).parse(req.body);

    // Test the submitted key before storing it. This prevents the UI from
    // displaying "Active" for an invalid key or an account without API credit.
    const verification = await verifyOpenAIAccess(body.key);
    if (!verification.ok) {
      return res.status(400).json({
        error: verification.message,
        status: verification.status
      });
    }

    const shop = await prisma.shop.findFirst();
    if (!shop) return res.status(404).json({ error: "Café introuvable." });

    await prisma.shop.update({
      where: { id: shop.id },
      data: { openaiKey: body.key }
    });

    res.json({
      ok: true,
      status: verification.status,
      message: verification.message,
      model: verification.model
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Format de clé OpenAI invalide." });
    }
    res.status(400).json({ error: "Impossible de vérifier ou d'enregistrer la clé OpenAI." });
  }
});

export default router;
