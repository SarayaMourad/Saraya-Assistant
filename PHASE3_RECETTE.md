# Phase 3 — /recette final verification + atomic recording

Phase 3 extends the Phase 2 workflow without changing the UI design.

## Flow
1. `/recette mock` (or `/recette` + 2 photos)
2. Owner verifies/edits data
3. `CONFIRME DONNÉES`
4. Owner accepts/rejects/modifies every correction
5. `CONFIRME CORRECTIONS`
6. Backend independently recalculates all deterministic corrections and final recette
7. Final preview is shown; nothing is persisted yet
8. Exact `OUI ENREGISTRE` performs one PostgreSQL transaction

## Final formula
`cashCaisse + (ramiGames × 1.500) + acceptedCorrectionTotal - depense - staffSalaire`

Ticket total remains separate and is not forced to match recette.

## Atomic transaction
The transaction stores Shift, ShiftStockLine, ShiftSaleLine, ShiftCorrection, ShiftExpense, ShiftMetric, ShiftExtraction, ShiftAuditEvent, ShiftItem and StockMovement, and updates physical Item quantities to the owner-validated FIN values. If any write fails, the whole transaction rolls back.

## Safety
- `CONFIRME CORRECTIONS` refuses any correction still PENDING.
- Calculations are rebuilt from validated source data before final preview and again before persistence.
- `OUI ENREGISTRE` is the only command that persists the shift.
- A source fingerprint plus session state protects against duplicate recording/retries.
- Mock mode never calls Gemini. Phase 3 persistence is real PostgreSQL persistence, so use the mock shift only in a development database.

No Prisma schema change is required from the Analytics DB / Phase 2 version.
