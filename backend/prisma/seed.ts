import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SHOP_ID = "saraya-shop";

const menu: Record<string, string[]> = {
  BOISSON: ["EAU 0.5L", "EAU 1.5L", "CANETTE", "BOISSON GAZEUZE", "EAU BOLAR", "ORANGINA"],
  CHICHA: ["MENTHE", "MENTHE RAISIN", "MENTHE CHWINGUM", "MENTHE JIBIAR", "JIBIAR", "POMME", "RAISIN", "CHIKHMANI", "CHWINGUM", "LOVE", "CHICHA PERSONEL"],
  JUS: ["CITRON", "JUS D'ORANGE", "MOJITO", "FRAISE", "COCKTEL", "LAIT DE POULE", "MANGA"],
  CAFE: ["CAPUCIN", "CHOCOLAT AU LAIT", "CHOCOLAT CHAUD", "THE", "JWAJEM", "KAMIA", "BOUZA", "DIRECT", "EXPRESS", "FILTRE", "AMERICAIN", "SPECIALE", "ALLONGE", "DEMI ALLONGE", "SANS MOUSSE", "SERRE"]
};

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/gi, "_").replace(/^_|_$/g, "").toUpperCase();

async function ensureItem(name: string, unit: string) {
  const existing = await prisma.item.findFirst({ where: { name, archivedAt: null } });
  return existing ?? prisma.item.create({ data: { name, unit, quantity: 0 } });
}

async function ensurePrice(priceCode: string, price: string, productId?: string) {
  const existing = await prisma.priceHistory.findFirst({
    where: { shopId: SHOP_ID, priceCode, validTo: null },
    orderBy: { validFrom: "desc" }
  });
  if (!existing) {
    await prisma.priceHistory.create({
      data: { shopId: SHOP_ID, productId, priceCode, price: new Prisma.Decimal(price), currency: "TND" }
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash("saraya2025", 12);

  await prisma.user.upsert({
    where: { email: "owner@saraya.com" },
    update: { name: "Mourad", passwordHash, role: "OWNER" },
    create: { email: "owner@saraya.com", passwordHash, name: "Mourad", role: "OWNER" }
  });

  await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: { name: "Saraya" },
    create: { id: SHOP_ID, name: "Saraya" }
  });

  // Preserve old demo items if present, and add the exact physical items needed by /recette.
  const physicalItems = [
    ["EAU 0.5L", "pcs"], ["EAU 1L", "pcs"], ["EAU 1.5L", "pcs"],
    ["CANNETTE", "pcs"], ["GAZEUSE", "pcs"], ["EAU BOLAR", "pcs"],
    ["CITRON", "L"], ["COFFEE BEANS", "kg"], ["TOMBAC", "g"]
  ] as const;
  const itemByName = new Map<string, Awaited<ReturnType<typeof ensureItem>>>();
  for (const [name, unit] of physicalItems) itemByName.set(name, await ensureItem(name, unit));

  const productByName = new Map<string, string>();
  for (const [category, names] of Object.entries(menu)) {
    for (const posName of names) {
      const product = await prisma.product.upsert({
        where: { shopId_posName: { shopId: SHOP_ID, posName } },
        update: { normalizedName: normalize(posName), category, isActive: true },
        create: { shopId: SHOP_ID, posName, normalizedName: normalize(posName), category }
      });
      productByName.set(posName, product.id);
    }
  }

  // Exact direct stock links.
  const directLinks: Array<[string, string]> = [
    ["EAU 0.5L", "EAU 0.5L"], ["EAU 1.5L", "EAU 1.5L"],
    ["CANETTE", "CANNETTE"], ["BOISSON GAZEUZE", "GAZEUSE"],
    ["EAU BOLAR", "EAU BOLAR"]
  ];
  for (const [productName, itemName] of directLinks) {
    const productId = productByName.get(productName)!;
    const item = itemByName.get(itemName)!;
    await prisma.productConsumptionRule.upsert({
      where: { productId_ruleCode: { productId, ruleCode: "DIRECT_STOCK" } },
      update: { itemId: item.id, expectedQtyPerSale: 1, unit: item.unit },
      create: { productId, itemId: item.id, ruleCode: "DIRECT_STOCK", expectedQtyPerSale: 1, unit: item.unit }
    });
  }

  // Kamia consumes one EAU 0.5L in the Saraya reconciliation rule.
  const kamiaId = productByName.get("KAMIA")!;
  await prisma.productConsumptionRule.upsert({
    where: { productId_ruleCode: { productId: kamiaId, ruleCode: "KAMIA_EAU_05" } },
    update: { itemId: itemByName.get("EAU 0.5L")!.id, expectedQtyPerSale: 1, unit: "pcs" },
    create: { productId: kamiaId, itemId: itemByName.get("EAU 0.5L")!.id, ruleCode: "KAMIA_EAU_05", expectedQtyPerSale: 1, unit: "pcs" }
  });

  // One sold citron glass corresponds to 0.2 L of physical citron.
  const citronId = productByName.get("CITRON")!;
  await prisma.productConsumptionRule.upsert({
    where: { productId_ruleCode: { productId: citronId, ruleCode: "CITRON_02L" } },
    update: { itemId: itemByName.get("CITRON")!.id, expectedQtyPerSale: 0.2, unit: "L" },
    create: { productId: citronId, itemId: itemByName.get("CITRON")!.id, ruleCode: "CITRON_02L", expectedQtyPerSale: 0.2, unit: "L" }
  });

  const coffeeNames = ["CAPUCIN", "DIRECT", "EXPRESS", "FILTRE", "AMERICAIN", "SPECIALE", "ALLONGE", "DEMI ALLONGE", "SANS MOUSSE", "SERRE"];
  for (const name of coffeeNames) {
    const productId = productByName.get(name)!;
    await prisma.productConsumptionRule.upsert({
      where: { productId_ruleCode: { productId, ruleCode: "COFFEE_GROUP" } },
      update: { itemId: itemByName.get("COFFEE BEANS")!.id, includeInNormalCount: true },
      create: { productId, itemId: itemByName.get("COFFEE BEANS")!.id, ruleCode: "COFFEE_GROUP" }
    });
  }

  for (const name of menu.CHICHA) {
    const productId = productByName.get(name)!;
    const personnel = name === "CHICHA PERSONEL";
    await prisma.productConsumptionRule.upsert({
      where: { productId_ruleCode: { productId, ruleCode: personnel ? "PERSONNEL_CHICHA" : "NORMAL_CHICHA" } },
      update: { itemId: itemByName.get("TOMBAC")!.id, includeInNormalCount: !personnel },
      create: { productId, itemId: itemByName.get("TOMBAC")!.id, ruleCode: personnel ? "PERSONNEL_CHICHA" : "NORMAL_CHICHA", includeInNormalCount: !personnel }
    });
  }

  await ensurePrice("EAU_05", "0.800", productByName.get("EAU 0.5L"));
  await ensurePrice("EAU_1L", "1.500");
  await ensurePrice("EAU_15", "1.500", productByName.get("EAU 1.5L"));
  await ensurePrice("CITRON", "2.500", productByName.get("CITRON"));
  await ensurePrice("CHICHA", "5.000");
  await ensurePrice("CANNETTE", "2.000", productByName.get("CANETTE"));
  await ensurePrice("GAZEUSE", "1.500", productByName.get("BOISSON GAZEUZE"));

  console.log("Seed Saraya terminé: compte, shop, inventaire /recette, menu caisse, règles et prix.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => prisma.$disconnect());
