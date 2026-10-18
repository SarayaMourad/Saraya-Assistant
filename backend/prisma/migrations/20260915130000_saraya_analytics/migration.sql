-- Saraya private cafe analytics layer.
-- Safe to apply after 20260914000000_init and replayable on a fresh PostgreSQL database via `prisma migrate deploy`.

ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "_analytics_placeholder" BOOLEAN;
ALTER TABLE "Item" DROP COLUMN IF EXISTS "_analytics_placeholder";
CREATE INDEX IF NOT EXISTS "Item_name_idx" ON "Item"("name");

CREATE TABLE "Worker" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "posName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isStockTracked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductConsumptionRule" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "itemId" TEXT,
  "ruleCode" TEXT NOT NULL,
  "expectedQtyPerSale" DOUBLE PRECISION,
  "unit" TEXT,
  "includeInNormalCount" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductConsumptionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceHistory" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "productId" TEXT,
  "priceCode" TEXT NOT NULL,
  "price" DECIMAL(12,3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement" ADD COLUMN "shiftId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "quantityBefore" DOUBLE PRECISION;
ALTER TABLE "StockMovement" ADD COLUMN "quantityAfter" DOUBLE PRECISION;

ALTER TABLE "Shift" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "workerId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "businessDate" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "cashCaisse" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "ramiGames" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "ramiMultiplier" DECIMAL(8,3);
ALTER TABLE "Shift" ADD COLUMN "ramiValue" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "ticketTotal" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "expenseTotal" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "staffSalary" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "automaticCorrectionTotal" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "acceptedCorrectionTotal" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "recetteBeforeCorrection" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "recetteFinale" DECIMAL(12,3);
ALTER TABLE "Shift" ADD COLUMN "totalItemsSold" DOUBLE PRECISION;
ALTER TABLE "Shift" ADD COLUMN "totalTransactions" INTEGER;
ALTER TABLE "Shift" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "Shift" ADD COLUMN "dataConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "correctionsConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "recordedAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "sourceFingerprint" TEXT;
ALTER TABLE "Shift" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Shift" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ShiftStockLine" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "itemId" TEXT,
  "rawItemName" TEXT NOT NULL,
  "normalizedItemName" TEXT,
  "unit" TEXT,
  "startQty" DOUBLE PRECISION,
  "addedQty" DOUBLE PRECISION,
  "endQty" DOUBLE PRECISION,
  "consumedQty" DOUBLE PRECISION,
  "aiStartQty" DOUBLE PRECISION,
  "aiAddedQty" DOUBLE PRECISION,
  "aiEndQty" DOUBLE PRECISION,
  "extractionConfidence" DOUBLE PRECISION,
  "wasOwnerModified" BOOLEAN NOT NULL DEFAULT false,
  "originalExtractedValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftStockLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftSaleLine" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "productId" TEXT,
  "category" TEXT NOT NULL,
  "rawProductName" TEXT NOT NULL,
  "normalizedProductName" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "ratio" DOUBLE PRECISION,
  "unitPrice" DECIMAL(12,3),
  "lineTotal" DECIMAL(12,3),
  "extractionConfidence" DOUBLE PRECISION,
  "wasOwnerModified" BOOLEAN NOT NULL DEFAULT false,
  "originalExtractedValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftSaleLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftCorrection" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "itemId" TEXT,
  "correctionCode" TEXT NOT NULL,
  "expectedQty" DOUBLE PRECISION,
  "actualConsumedQty" DOUBLE PRECISION,
  "differenceQty" DOUBLE PRECISION,
  "calculationRule" TEXT NOT NULL,
  "priceUsed" DECIMAL(12,3),
  "automaticAmount" DECIMAL(12,3) NOT NULL,
  "acceptedAmount" DECIMAL(12,3) NOT NULL,
  "decision" TEXT NOT NULL,
  "ownerReason" TEXT,
  "ownerModifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftMetric" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "metricCode" TEXT NOT NULL,
  "value" DECIMAL(18,6) NOT NULL,
  "unit" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftExpense" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "amount" DECIMAL(12,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftExtraction" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "extractedJson" JSONB NOT NULL,
  "validatedJson" JSONB,
  "aiModel" TEXT,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  CONSTRAINT "ShiftExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftAuditEvent" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Worker_shopId_name_key" ON "Worker"("shopId", "name");
CREATE INDEX "Worker_shopId_active_idx" ON "Worker"("shopId", "active");
CREATE UNIQUE INDEX "Product_shopId_posName_key" ON "Product"("shopId", "posName");
CREATE INDEX "Product_shopId_category_isActive_idx" ON "Product"("shopId", "category", "isActive");
CREATE INDEX "Product_normalizedName_idx" ON "Product"("normalizedName");
CREATE UNIQUE INDEX "ProductConsumptionRule_productId_ruleCode_key" ON "ProductConsumptionRule"("productId", "ruleCode");
CREATE INDEX "ProductConsumptionRule_ruleCode_idx" ON "ProductConsumptionRule"("ruleCode");
CREATE INDEX "ProductConsumptionRule_itemId_idx" ON "ProductConsumptionRule"("itemId");
CREATE INDEX "PriceHistory_shopId_priceCode_validFrom_idx" ON "PriceHistory"("shopId", "priceCode", "validFrom");
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");
CREATE INDEX "StockMovement_shiftId_idx" ON "StockMovement"("shiftId");
CREATE UNIQUE INDEX "Shift_sourceFingerprint_key" ON "Shift"("sourceFingerprint");
CREATE INDEX "Shift_shopId_businessDate_idx" ON "Shift"("shopId", "businessDate");
CREATE INDEX "Shift_workerId_businessDate_idx" ON "Shift"("workerId", "businessDate");
CREATE INDEX "Shift_status_closedAt_idx" ON "Shift"("status", "closedAt");
CREATE INDEX "ShiftStockLine_shiftId_idx" ON "ShiftStockLine"("shiftId");
CREATE INDEX "ShiftStockLine_itemId_idx" ON "ShiftStockLine"("itemId");
CREATE INDEX "ShiftSaleLine_shiftId_category_idx" ON "ShiftSaleLine"("shiftId", "category");
CREATE INDEX "ShiftSaleLine_productId_idx" ON "ShiftSaleLine"("productId");
CREATE INDEX "ShiftSaleLine_normalizedProductName_idx" ON "ShiftSaleLine"("normalizedProductName");
CREATE INDEX "ShiftCorrection_shiftId_idx" ON "ShiftCorrection"("shiftId");
CREATE INDEX "ShiftCorrection_correctionCode_idx" ON "ShiftCorrection"("correctionCode");
CREATE INDEX "ShiftCorrection_decision_idx" ON "ShiftCorrection"("decision");
CREATE UNIQUE INDEX "ShiftMetric_shiftId_metricCode_key" ON "ShiftMetric"("shiftId", "metricCode");
CREATE INDEX "ShiftMetric_metricCode_idx" ON "ShiftMetric"("metricCode");
CREATE INDEX "ShiftExpense_shiftId_idx" ON "ShiftExpense"("shiftId");
CREATE INDEX "ShiftExtraction_shiftId_sourceType_idx" ON "ShiftExtraction"("shiftId", "sourceType");
CREATE INDEX "ShiftExtraction_sourceHash_idx" ON "ShiftExtraction"("sourceHash");
CREATE INDEX "ShiftAuditEvent_shiftId_createdAt_idx" ON "ShiftAuditEvent"("shiftId", "createdAt");
CREATE INDEX "ShiftAuditEvent_eventType_idx" ON "ShiftAuditEvent"("eventType");

ALTER TABLE "Worker" ADD CONSTRAINT "Worker_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductConsumptionRule" ADD CONSTRAINT "ProductConsumptionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductConsumptionRule" ADD CONSTRAINT "ProductConsumptionRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftStockLine" ADD CONSTRAINT "ShiftStockLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftStockLine" ADD CONSTRAINT "ShiftStockLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftSaleLine" ADD CONSTRAINT "ShiftSaleLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSaleLine" ADD CONSTRAINT "ShiftSaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftCorrection" ADD CONSTRAINT "ShiftCorrection_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftCorrection" ADD CONSTRAINT "ShiftCorrection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftMetric" ADD CONSTRAINT "ShiftMetric_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftExpense" ADD CONSTRAINT "ShiftExpense_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftExtraction" ADD CONSTRAINT "ShiftExtraction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAuditEvent" ADD CONSTRAINT "ShiftAuditEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
