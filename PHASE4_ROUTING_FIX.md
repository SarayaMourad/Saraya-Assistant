# Saraya — Phase 3 FIX + Phase 4 routing fix

## Fixed
- `/analyse ...` commands are routed before any active/completed `/recette` session state.
- A completed `/recette` no longer hijacks normal assistant or analytics messages.
- Re-sending exact `OUI ENREGISTRE` while the completed session is still in memory returns the duplicate-protection message and performs no second write.
- Phase 3 stock persistence continues to deduct physical consumption (`START + AJOUT - FIN`) from master inventory, with unit conversion where needed; it does not replace master stock with `FIN`.

## Test existing saved shift
No db:setup and no new mock shift are required. Restart backend/frontend, then run:
- `/analyse dernier`
- `/analyse stock`
- `/analyse ventes`
- `/analyse cafe`
- `/analyse chicha`

Then send `OUI ENREGISTRE` once more to verify the in-memory duplicate guard if the same backend process still holds the completed session. PostgreSQL's unique shift fingerprint remains the persistence-level duplicate guard for actual recording attempts.
