import { prisma } from "./prisma";
import { ChatAction } from "../types";

export async function executeAction(action: ChatAction) {
  switch (action.type) {
    case "add_stock": {
      const item = await prisma.item.findFirst({
        where: { id: action.data.itemId, archivedAt: null }
      });
      if (!item) throw new Error("Article introuvable");

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.item.update({
          where: { id: item.id },
          data: { quantity: { increment: action.data.quantity } }
        });
        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            type: "IN",
            quantity: action.data.quantity,
            quantityBefore: item.quantity,
            quantityAfter: next.quantity,
            source: "CHAT",
            note: action.data.note || "Ajout de stock depuis l’assistant"
          }
        });
        return next;
      });

      return {
        message: `${item.name} : +${action.data.quantity} ${item.unit}. Stock actuel : ${updated.quantity} ${item.unit}.`
      };
    }

    case "add_item": {
      const existing = await prisma.item.findFirst({
        where: { name: { equals: action.data.name, mode: "insensitive" }, archivedAt: null }
      });
      if (existing) throw new Error("Cet article existe déjà.");

      const item = await prisma.item.create({
        data: {
          name: action.data.name,
          unit: action.data.unit,
          quantity: action.data.initialQuantity || 0
        }
      });

      if (action.data.initialQuantity && action.data.initialQuantity > 0) {
        await prisma.stockMovement.create({
          data: {
            itemId: item.id,
            type: "IN",
            quantity: action.data.initialQuantity,
            quantityBefore: 0,
            quantityAfter: item.quantity,
            source: "CHAT",
            note: "Stock initial lors de la création"
          }
        });
      }

      return { message: `Article "${item.name}" créé avec ${item.quantity} ${item.unit}.` };
    }

    case "update_item": {
      const item = await prisma.item.findFirst({
        where: { id: action.data.itemId, archivedAt: null }
      });
      if (!item) throw new Error("Article introuvable");

      const delta = action.data.quantityDelta || 0;
      const nextQuantity = item.quantity + delta;
      if (nextQuantity < 0) throw new Error("Le stock ne peut pas devenir négatif.");

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.item.update({
          where: { id: item.id },
          data: {
            ...(action.data.name !== undefined ? { name: action.data.name } : {}),
            ...(action.data.unit !== undefined ? { unit: action.data.unit } : {}),
            quantity: nextQuantity
          }
        });

        if (delta !== 0) {
          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              type: "ADJUST",
              quantity: delta,
              quantityBefore: item.quantity,
              quantityAfter: next.quantity,
              source: "CHAT",
              note: "Ajustement demandé dans l'assistant"
            }
          });
        }
        return next;
      });

      return { message: `${updated.name} mis à jour. Stock : ${updated.quantity} ${updated.unit}.` };
    }

    case "delete_item": {
      const item = await prisma.item.findFirst({
        where: { id: action.data.itemId, archivedAt: null }
      });
      if (!item) throw new Error("Article introuvable");

      await prisma.item.update({
        where: { id: item.id },
        data: { archivedAt: new Date() }
      });

      return { message: `Article "${item.name}" archivé.` };
    }

    case "close_shift": {
      const variance = action.data.cashCounted - action.data.cashExpected;

      const result = await prisma.$transaction(async (tx) => {
        const shift = await tx.shift.create({
          data: {
            shiftType: action.data.shiftType,
            cashExpected: action.data.cashExpected,
            cashCounted: action.data.cashCounted,
            cashVariance: variance,
            notes: action.data.notes
          }
        });

        for (const consumed of action.data.consumed) {
          const item = await tx.item.findFirst({
            where: { id: consumed.itemId, archivedAt: null }
          });
          if (!item) continue;
          if (item.quantity - consumed.quantity < 0) {
            throw new Error(`Stock insuffisant pour ${item.name}.`);
          }

          await tx.shiftItem.create({
            data: {
              shiftId: shift.id,
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
              note: `Clôture shift ${shift.shiftType}`
            }
          });
        }

        return shift;
      });

      return {
        message: `Shift ${result.shiftType} clôturé. Caisse comptée : ${result.cashCounted.toFixed(2)} DT. Écart : ${result.cashVariance.toFixed(2)} DT.`
      };
    }
  }
}
