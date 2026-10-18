# Saraya V6.1 — OpenAI edition

## What changed
- Replaced the Gemini-compatible OpenAI SDK endpoint with the official OpenAI API.
- Chat, analytics interpretation, /recette vision extraction, corrections and presentation use `gpt-4.1-mini` by default.
- Settings now verifies and saves an OpenAI API key; the existing Prisma `Shop.openaiKey` column is reused (no migration needed).
- /recette premium stage cards and confirmation buttons are unchanged.
- The stock calculation, shift transaction, historical analytics, and confirmation rules are unchanged.
- /recette mock still works without an API key.

## Setup (Windows PowerShell)
1. Extract the zip to a new folder. Keep your existing PostgreSQL database; DO NOT reset or seed over production data.
2. In backend, create `.env` from `.env.example`, then copy your **existing** DATABASE_URL and JWT_SECRET into it. Do not publish `.env`.
3. Set `OPENAI_API_KEY=sk-...` in backend `.env` OR enter the key in Settings -> Clé OpenAI. Do not put the key in frontend or share it in chat.
4. `cd backend; npm install; npm run prisma:generate; npm run dev`
5. In another terminal: `cd frontend; npm install; npm run dev`
6. Log in, visit Réglages -> Clé OpenAI and check Statut Active. Test `/recette mock` first, then `/recette` with exactly two photos.
7. For actual shift closure, review all values before `CONFIRME DONNÉES`, `CONFIRME CORRECTIONS`, and `OUI ENREGISTRE`. This last command writes real data and deducts stock.

## Important
- ChatGPT Plus and OpenAI API billing are separate.
- Existing Gemini keys stored in Shop.openaiKey will not work with OpenAI; replace them with an OpenAI key. Environment `OPENAI_API_KEY` takes priority.
- No live API or real database test was run as part of this offline conversion.
- Keep a backup of the existing database before first real write.
