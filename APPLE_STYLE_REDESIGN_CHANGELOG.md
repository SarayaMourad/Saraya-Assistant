# Saraya — Premium product redesign

## Implemented
- New system-first premium visual language: neutral canvas, restrained green, larger radii, subtle depth, consistent typography and spacing.
- Wider, more comfortable application shell and translucent navigation/composer surfaces.
- `/recette` structured UI driven by backend data, not by AI prose parsing.
- Guided `/recette` stepper: Documents → Vérification → Corrections → Recette → Enregistré.
- Extraction view: metric cards + real stock table + ticket table.
- Correction view: one article per row with real/expected/difference/correction columns, plus café/chicha metrics.
- Final recette view: large final total, accounting ledger and recorded-success panel.
- Normal assistant answers now use readable paragraphs instead of a single dense text block.
- Natural command aliases added for common variants such as `confirme correction`, `confirmer corrections`, `confirmer données`, `accepter tout`, `oui enregistrer`.
- Existing Gemini analytics tools and deterministic `/recette` calculations are preserved.

## Safety / architecture
- Financial calculations remain backend-deterministic.
- Structured cards use `recetteData`, `recetteCalculations`, and `recetteFinal` returned by the backend.
- Gemini wording is supplementary and cannot change the numbers rendered in the structured tables.
- No database schema or migration was reset.

## Verification performed
- Frontend TypeScript: `tsc --noEmit` passed.
- Backend TypeScript: `tsc --noEmit` passed.
- Next.js production build was attempted but this sandbox could not download the platform SWC package because outbound access to registry.npmjs.org is unavailable. The build therefore could not be completed here; this was an environment/network limitation, not a TypeScript compile failure.

## Setup note
Secrets are intentionally not packaged. Put your local values back into `backend/.env` (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY) before running.
