# Saraya Assistant V6.1 — Intelligence Discipline

V6.1 is a refinement of V6. It does not change `/recette`, stock deduction, atomic database saving, or the analytics-tool architecture.

## Changes
- Evidence discipline in Gemini instructions: Fact / Interpretation / Experiment to test.
- Explicit prohibition on inventing margins, costs, customer behavior, occupancy, quiet hours, or causes.
- Missing business data is surfaced instead of guessed.
- `analyse_last_shift_expert` now includes a deterministic reference from up to 10 prior recorded shifts.
- Coffee and chicha consumption ratios are compared with prior observed ranges.
- An anomaly is flagged only when the latest ratio is outside the observed prior range (with at least 2 comparable prior shifts); Gemini does not invent a threshold.
- Recommendations not proven by Saraya data must be framed as experiments with an observable success metric.
- Defensive frontend cleanup removes dangling `svg` rendering artifacts.

## Trust boundary
PostgreSQL + deterministic backend remain the source of truth. Gemini interprets controlled tool results; it does not receive arbitrary SQL access and does not modify deterministic `/recette` calculations.
