# Phase 2 /recette — mode mock sans Gemini

Cette version permet de tester Phase 1 + Phase 2 sans crédit API Gemini.

## Test
1. Dans Assistant, envoyer `/recette mock` sans photo.
2. Vérifier les données mock. Vous pouvez tester `EAU 0.5L FIN = 12` ou `MENTHE Qte = 8`.
3. Envoyer `CONFIRME DONNÉES`.
4. Le backend calcule automatiquement les corrections Saraya, le ratio café/beans et chicha/tombac.
5. Tester : `ACCEPTE TOUT`, `REJETTE EAU 0.5L`, `ACCEPTE CANNETTE`, `MODIFIE CANNETTE = -2.000`.
6. Envoyer `CONFIRME CORRECTIONS`.

Aucune écriture permanente, aucune déduction stock et aucune API Gemini ne sont effectuées par ce parcours mock.
