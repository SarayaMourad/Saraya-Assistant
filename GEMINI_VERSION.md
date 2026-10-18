# Saraya Assistant — Version Gemini

Cette version conserve la logique métier, PostgreSQL, Prisma, /recette, corrections, confirmations et analytics de la version fournie.

Le fournisseur IA a été remplacé par Gemini. Le backend utilise le endpoint officiel de compatibilité OpenAI de Google uniquement comme protocole/SDK de transport : les requêtes IA sont envoyées à l’API Gemini de Google.

Variables backend :
- GEMINI_API_KEY
- GEMINI_MODEL=gemini-3.8-flash
- GEMINI_VISION_MODEL=gemini-3.8-flash

La clé peut aussi être saisie dans Réglages > Clé Gemini.

## Compatibilité base de données
Le champ Prisma interne `openaiKey` est conservé uniquement pour éviter de casser la base PostgreSQL existante et ses migrations. Dans cette version, ce champ stocke la clé Gemini et toutes les routes/UI exposées utilisent le nom Gemini.

## Validation effectuée
- Backend TypeScript : `npm run build` OK.
- Frontend TypeScript : `tsc --noEmit` OK.
- Le build Next.js complet n'a pas pu être exécuté dans l'environnement de préparation car Next.js a tenté de télécharger son binaire SWC depuis npm et l'accès réseau du conteneur était indisponible.

## Mise à jour démo — 2 photos + conservation du chat
- Le sélecteur du chat accepte jusqu'à 2 images et permet de les ajouter en une seule sélection ou une par une.
- Chaque image peut être retirée séparément avant l'envoi.
- `/recette` continue d'exiger exactement 2 photos côté backend.
- La conversation texte est conservée dans le navigateur pendant 30 minutes après la dernière activité et restaurée après un rafraîchissement/navigation dans ce délai.
- Les aperçus locaux des images ne sont pas persistés après un rechargement de page (les URLs locales du navigateur expirent).
- La session backend `/recette` reste actuellement valable 60 minutes d'inactivité tant que le serveur Node reste en cours d'exécution.
