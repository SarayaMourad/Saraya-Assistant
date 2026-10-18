# Saraya Assistant — mise à jour finale avant test API

## Ajout de stock historisé
- Chaque `Ajouter du stock` crée un `StockMovement` `IN` avec quantité ajoutée, quantité avant, quantité après, source et date.
- Les ajouts depuis l'assistant sont historisés de la même façon.
- L'opération quantité + mouvement est transactionnelle.
- Aucun changement de schéma Prisma n'est requis : `quantityBefore` et `quantityAfter` existent déjà.

## Analyse approvisionnement
Commande : `/analyse approvisionnement`

Fenêtre : 30 jours. Affiche par article :
- nombre d'ajouts ;
- quantité totale ajoutée ;
- quantité moyenne par ajout ;
- intervalle moyen entre les ajouts quand au moins deux ajouts existent ;
- dernier ajout et avant → après.

Le contexte envoyé à l'IA inclut aussi l'approvisionnement des 30 derniers jours, afin que l'API puisse raisonner sur ce rythme quand elle sera activée.

## Guide d'utilisation
Réglages → Aide → Guide d'utilisation.
Le guide explique le stock, `/recette`, toutes les confirmations/corrections, `OUI ENREGISTRE`, les commandes `/analyse`, le mock et le rôle futur de l'API.

## Tests
Backend TypeScript : OK.
Frontend TypeScript : OK.

## Installation
Aucune nouvelle migration. Conserver la base actuelle et copier le `.env` backend existant. Exécuter `npm install` puis `npm run dev` dans backend et frontend.
