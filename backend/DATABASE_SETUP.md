# Saraya PostgreSQL setup

The Prisma migrations in this project are the source of truth for the database schema.

## Fresh PostgreSQL database

1. Create an empty PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` (plus your other private values).
3. From `backend/`, run:

```bash
npm install
npm run db:setup
```

`db:setup` runs all committed migrations, generates Prisma Client, and seeds the Saraya shop configuration.

For later production deployments (schema migrations only):

```bash
npm run db:deploy
```

Run the seed again when you intentionally want to ensure the POS catalogue/rules/prices exist:

```bash
npm run db:seed
```

The seed is idempotent: it upserts/looks up records instead of intentionally duplicating the catalogue.

## Analytics migration

`20260915130000_saraya_analytics` extends the existing Saraya schema with:

- Worker
- Product (POS catalogue)
- ProductConsumptionRule
- PriceHistory
- expanded Shift
- ShiftStockLine
- ShiftSaleLine
- ShiftCorrection
- ShiftMetric
- ShiftExpense
- ShiftExtraction
- ShiftAuditEvent
- expanded StockMovement ledger fields

It keeps the old ShiftItem and existing stock routes compatible.

## Important

Database migrations create the storage layer. The `/recette` chat workflow still needs application code that writes the validated extraction, correction decisions and stock movements into these tables in one transaction.
