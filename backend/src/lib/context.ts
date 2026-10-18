import { prisma } from "./prisma";

function dateFr(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export async function buildContext() {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [shop, items, movements, additions, lastShift, weekShifts] = await Promise.all([
    prisma.shop.findFirst(),
    prisma.item.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({ include: { item: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.stockMovement.findMany({
      where: { type: "IN", source: { in: ["MANUAL", "CHAT"] }, createdAt: { gte: since30 }, item: { archivedAt: null } },
      include: { item: true }, orderBy: { createdAt: "asc" }
    }),
    prisma.shift.findFirst({ where: { status: "RECORDED" }, orderBy: { recordedAt: "desc" } }),
    prisma.shift.findMany({ where: { status: "RECORDED", recordedAt: { gte: since7 } }, orderBy: { recordedAt: "desc" } })
  ]);

  const totalCash = weekShifts.reduce((sum, shift) => sum + Number(shift.recetteFinale || shift.cashCounted || 0), 0);
  const grouped = new Map<string, typeof additions>();
  for (const movement of additions) grouped.set(movement.itemId, [...(grouped.get(movement.itemId) || []), movement]);
  const replenishment = [...grouped.values()].map((list) => {
    const total = round3(list.reduce((sum, movement) => sum + Number(movement.quantity), 0));
    const intervals: number[] = [];
    for (let i = 1; i < list.length; i++) intervals.push((list[i].createdAt.getTime() - list[i - 1].createdAt.getTime()) / 86400000);
    const avgDays = intervals.length ? round3(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null;
    return `- ${list[0].item.name}: ${list.length} ajout(s), +${total} ${list[0].item.unit} au total, moyenne +${round3(total / list.length)} ${list[0].item.unit}${avgDays !== null ? `, rythme moyen ${avgDays} jour(s)` : ", rythme pas encore calculable"}`;
  });

  return [
    `Café: ${shop?.name || "Saraya"}`,
    `Date: ${dateFr(new Date())}`,
    `Stock actuel:`,
    ...items.map((item) => `- ${item.name}: ${item.quantity} ${item.unit}`),
    `Derniers mouvements de stock:`,
    ...movements.map((m) => `- ${m.type} ${m.item.name}: ${m.quantity} ${m.item.unit} (${dateFr(m.createdAt)}, source ${m.source}${m.quantityBefore !== null && m.quantityAfter !== null ? `, ${m.quantityBefore} → ${m.quantityAfter}` : ""})`),
    `Approvisionnement manuel — 30 derniers jours:`,
    ...(replenishment.length ? replenishment : ["- aucun ajout enregistré"]),
    `Dernier shift: ${lastShift ? `recette ${Number(lastShift.recetteFinale || 0).toFixed(3)} DT, ${dateFr(lastShift.recordedAt || lastShift.closedAt)}` : "aucun"}`,
    `7 derniers jours: ${totalCash.toFixed(3)} DT de recette, ${weekShifts.length} shift(s) enregistré(s).`
  ].join("\n");
}
