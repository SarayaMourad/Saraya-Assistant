# Saraya — Phase 3 fix + Phase 4 Analytics

## Phase 3 inventory fix
Master stock is never replaced by the shift FIN value.

`consumed = START + AJOUT - FIN`

`new master stock = current master stock - consumed`

Units are normalized at persistence time. Example: Coffee Beans 0.5 kg consumed from a master stock stored in grams deducts 500 g. Financial correction decisions never change physical consumption.

## Phase 4
Phase 4 reads the permanent PostgreSQL history through controlled queries. It does not give the model arbitrary SQL access and the commands below work without Gemini:

- `/analyse` — help
- `/analyse dernier` — latest recorded shift
- `/analyse 7j` (or 30j, etc., max 365) — period summary
- `/analyse stock` — current inventory and recent /recette consumption movements
- `/analyse corrections` — 7-day automatic vs retained corrections
- `/analyse ventes` — 7-day top sold products
- `/analyse cafe` — 7-day coffee/beans totals and global ratio
- `/analyse chicha` — 7-day chicha/tombac totals and global ratio

No Prisma migration is required for this build.
