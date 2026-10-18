import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" }
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Impossible de charger le stock." });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = z.object({
      name: z.string().trim().min(1).max(100),
      unit: z.string().trim().min(1).max(20)
    }).parse(req.body);

    const duplicate = await prisma.item.findFirst({
      where: { name: { equals: body.name, mode: "insensitive" }, archivedAt: null }
    });
    if (duplicate) return res.status(409).json({ error: "Cet article existe déjà." });

    const item = await prisma.item.create({ data: body });
    res.status(201).json(item);
  } catch {
    res.status(400).json({ error: "Nom ou unité invalide." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = z.object({
      name: z.string().trim().min(1).max(100).optional(),
      unit: z.string().trim().min(1).max(20).optional(),
      quantity: z.number().finite().min(0).optional()
    }).parse(req.body);

    const existing = await prisma.item.findFirst({
      where: { id: req.params.id, archivedAt: null }
    });
    if (!existing) return res.status(404).json({ error: "Article introuvable." });

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: existing.id },
        data: body
      });

      if (body.quantity !== undefined && body.quantity !== existing.quantity) {
        const delta = body.quantity - existing.quantity;
        await tx.stockMovement.create({
          data: {
            itemId: existing.id,
            // A positive manual change is a real replenishment, even when it
            // comes from the per-item "Modifier" sheet. Phase 4 filters IN
            // movements to calculate the stock-adding rhythm.
            type: delta > 0 ? "IN" : "ADJUST",
            quantity: delta,
            quantityBefore: existing.quantity,
            quantityAfter: body.quantity,
            source: "MANUAL",
            note: delta > 0
              ? "Ajout manuel depuis la fiche article"
              : "Retrait/correction manuelle du stock"
          }
        });
      }
      return updated;
    });

    res.json(item);
  } catch {
    res.status(400).json({ error: "Modification invalide." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const item = await prisma.item.findFirst({
      where: { id: req.params.id, archivedAt: null }
    });
    if (!item) return res.status(404).json({ error: "Article introuvable." });

    await prisma.item.update({
      where: { id: item.id },
      data: { archivedAt: new Date() }
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Impossible de supprimer l'article." });
  }
});

router.post("/:id/stock", async (req, res) => {
  try {
    const body = z.object({
      quantity: z.number().finite().positive()
    }).parse(req.body);

    const item = await prisma.item.findFirst({
      where: { id: req.params.id, archivedAt: null }
    });
    if (!item) return res.status(404).json({ error: "Article introuvable." });

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.item.update({
        where: { id: item.id },
        data: { quantity: { increment: body.quantity } }
      });
      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          type: "IN",
          quantity: body.quantity,
          quantityBefore: item.quantity,
          quantityAfter: next.quantity,
          source: "MANUAL",
          note: "Ajout manuel depuis l’écran Stock"
        }
      });
      return next;
    });

    res.json(updated);
  } catch {
    res.status(400).json({ error: "Quantité invalide." });
  }
});

export default router;
