# Real /recette document fix

- Accepts the real SARAYA SHIFT STOCK layout.
- Accepts POS tickets with Libellé / Qte / Ratio(%) / Total and no explicit price column.
- Ratio is never treated as unit price.
- If unit price is absent but quantity and total are present, backend computes total / quantity deterministically.
- Normalizes harmless Gemini JSON variations (missing optional fields, numeric strings, French decimal commas).
- Keeps missing/illegible business values as null; does not invent them.
- Error messages now distinguish unreadable JSON from missing stock/ticket lines.
