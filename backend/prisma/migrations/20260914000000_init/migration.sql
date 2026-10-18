CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shop" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Saraya',
  "openaiKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Item" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shift" (
  "id" TEXT NOT NULL,
  "shiftType" TEXT NOT NULL,
  "cashExpected" DOUBLE PRECISION NOT NULL,
  "cashCounted" DOUBLE PRECISION NOT NULL,
  "cashVariance" DOUBLE PRECISION NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftItem" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "consumedQty" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "ShiftItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");
CREATE UNIQUE INDEX "ShiftItem_shiftId_itemId_key" ON "ShiftItem"("shiftId", "itemId");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShiftItem" ADD CONSTRAINT "ShiftItem_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftItem" ADD CONSTRAINT "ShiftItem_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
