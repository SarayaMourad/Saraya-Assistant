# Mise à jour — Présentation IA + outils analytics contrôlés

## 1. Présentation IA de /recette
Les calculs restent 100% déterministes dans le backend. Gemini reçoit uniquement le résultat structuré déjà calculé et le reformule pour le propriétaire. Gemini n'a pas le droit de modifier/recalculer les nombres ni d'inventer une cause.

Commande `MONTRE MOI LE DETAIL` : affiche à tout moment la vue backend complète pendant la session /recette.
En cas d'erreur/indisponibilité Gemini, la vue déterministe backend est utilisée automatiquement (fallback).

## 2. Analytics tools explicites
Le chat Gemini peut maintenant appeler :
- `get_last_shift`
- `analyse_sales`
- `analyse_stock`
- `analyse_cafe`
- `analyse_chicha`
- `analyse_consumption`
- `compare_periods`

Les outils interrogent PostgreSQL et calculent les faits côté backend. Gemini sert de routeur + explication. Il peut appeler plusieurs outils pour une question comparative (ex. café vs chicha).

Règles renforcées : ne pas confondre correction avec chiffre d'affaires/performance; distinguer quantité, revenu, consommation et correction; ne jamais présenter une cause non prouvée comme un fait.
