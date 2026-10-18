# Saraya Assistant — Premium V3 fixes

- /recette verification, correction confirmation, correction decisions and final recording no longer fail when Gemini presentation is unavailable. These deterministic stages use a local trusted fallback.
- Gemini is still required to extract the two real /recette photos and for normal AI chat/analytics routing.
- Added direct workflow buttons to /recette so the owner can confirm data, accept corrections, confirm corrections and record without memorizing commands.
- Kept natural command aliases for typed commands.
- Expanded premium UI into a desktop app shell with sidebar, responsive mobile navigation, improved spacing, surfaces, typography, tables, cards and interaction states.
- Added Node engine guidance (Node 20/22; Node 24 is intentionally excluded for this Next.js 14 project).
- Do not run `npm audit fix --force` unless you intentionally want dependency upgrades and have retested the app.
