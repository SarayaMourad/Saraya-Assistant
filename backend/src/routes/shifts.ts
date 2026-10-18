import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/close", async (req, res) => {
  try {
    const body = z.object({
      shiftType: z.enum(["MORNING", "EVENING"]),
      cashExpected: z.number().finite(),
      cashCounted: z.number().finite(),
      consumed: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().finite().min(0)
      })),
      notes: z.string().max(1000).optional()
    }).parse(req.body);

    const variance = body.cashCounted - body.cashExpected;

    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          shiftType: body.shiftType,
          cashExpected: body.cashExpected,
          cashCounted: body.cashCounted,
          cashVariance: variance,
          notes: body.notes
        }
      });

      for (const consumed of body.consumed.filter((x) => x.quantity > 0)) {
        const item = await tx.item.findFirst({
          where: { id: consumed.itemId, archivedAt: null }
        });
        if (!item) throw new Error("Article introuvable.");
        if (item.quantity < consumed.quantity) {
          throw new Error(`Stock insuffisant pour ${item.name}.`);
        }

        await tx.shiftItem.create({
          data: {
            shiftId: created.id,
            itemId: item.id,
            consumedQty: consumed.quantity
          }
        });

        await tx.item.update({
          where: { id: item.id },
          data: { quantity: { decrement: consumed.quantity } }
        });

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            type: "OUT",
            quantity: -consumed.quantity,
            source: "CHAT",
            note: `Clôture ${body.shiftType}`
          }
        });
      }

      return created;
    });

    res.status(201).json(shift);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Impossible de clôturer le shift."
    });
  }
});

export default router;
