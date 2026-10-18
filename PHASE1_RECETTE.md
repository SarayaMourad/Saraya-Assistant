# /recette — Phase 1

Implemented in this build:

1. Send exactly two images with `/recette`.
2. Gemini vision extracts the SARAYA SHIFT STOCK sheet and POS ticket into structured JSON.
3. Saraya displays every extracted stock and ticket line for owner review.
4. The owner can correct values in natural language, for example `EAU 0.5L FIN = 12` or `MENTHE Qte = 8`.
5. Exact `CONFIRME DONNÉES` moves the temporary session to `DATA_CONFIRMED`.
6. No financial correction, database shift write, or stock deduction occurs in Phase 1.

Important: Phase 1 state is intentionally in backend memory. Restarting the backend clears an uncompleted review. Persistent draft storage can be added when the final /recette transaction workflow is implemented.
