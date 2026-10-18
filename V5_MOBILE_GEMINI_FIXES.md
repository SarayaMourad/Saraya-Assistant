# V5 Mobile + Gemini fixes

- Moved mobile Stock / Assistant / Réglages navigation from the bottom to a floating top dock so it does not collide with Netlify bottom overlays/badges.
- Preserved desktop sidebar.
- Reduced mobile composer bottom spacing now that navigation is no longer underneath it.
- Added bounded Gemini request timeout and disabled SDK automatic retries to avoid very long waits.
- Removed optional Gemini re-presentation calls from deterministic /recette verification/confirmation/save stages; these stages now return backend-trusted structured data immediately.
- Gemini remains used for the two-photo extraction and normal AI chat.
- Gemini key UI requests have explicit timeouts and the modal no longer stays blocked indefinitely; status is refreshed after a timeout.
- No database migrations or deterministic business formulas were changed.
