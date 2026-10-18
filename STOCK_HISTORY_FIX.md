# Correctif final — historique des ajouts de stock

Les deux chemins de l'interface qui peuvent augmenter le stock sont maintenant historisés comme `StockMovement.type = IN` :

- bouton global **Ajouter du stock** (`POST /items/:id/stock`)
- champ **Ajouter** dans la fiche d'un article (`PATCH /items/:id` avec une quantité finale supérieure)

Une diminution manuelle reste enregistrée séparément comme `ADJUST` et n'est donc pas comptée comme approvisionnement par `/analyse approvisionnement`.

La quantité, la quantité avant, la quantité après, la source et la date sont conservées dans PostgreSQL.

Aucune migration Prisma supplémentaire n'est nécessaire.
