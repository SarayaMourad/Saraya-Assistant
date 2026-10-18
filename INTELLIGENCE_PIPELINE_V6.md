# Saraya Assistant V6 — Expert intelligence pipeline

## What changed

- Broad questions such as “Analyse le dernier shift” no longer receive only a small summary.
- The backend builds a complete, deterministic dossier for the latest recorded shift with `analyse_last_shift_expert`.
- That dossier contains finance, every sale line, top products, physical stock consumption, corrections, café metrics, chicha metrics and useful deterministic ratios.
- Gemini receives those trusted facts and acts only as the interpreter: it explains relationships, priorities and points to verify without inventing numbers or causes.
- If Gemini is temporarily unavailable, Saraya returns a richer deterministic fallback instead of losing the business answer.
- Narrow analytics questions still use controlled analytics tools (`get_last_shift`, `analyse_sales`, `analyse_stock`, `analyse_cafe`, `analyse_chicha`, `analyse_consumption`, `compare_periods`).
- Gemini timeout is 45 seconds and transient API failures can be retried by the SDK (max 2 retries).

## Trust boundary

PostgreSQL + backend calculations are the source of truth. Gemini never receives arbitrary SQL access and never calculates or writes trusted financial/stock values. It interprets structured results returned by controlled tools.
