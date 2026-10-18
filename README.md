# Saraya Assistant

Application full-stack mobile-first pour le café Saraya.

## Stack

- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand, Axios
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod
- IA: Gemini, chat et lecture d'images via Gemini (modèle par défaut `gemini-3.8-flash`)
- Déploiement: Netlify + Railway + Railway PostgreSQL

## Structure

```text
Saraya-Assistant/
├── frontend/
└── backend/
```

## 1. Prérequis

- Node.js 20+
- PostgreSQL 14+
- Une clé Gemini si vous voulez utiliser l'assistant IA

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Configurez `DATABASE_URL` et `JWT_SECRET`.

Puis:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API: `http://localhost:4000`

Compte de test:

- Email: `owner@saraya.com`
- Mot de passe: `saraya2025`

Le seed crée aussi le café Saraya et les articles de test.

## 3. Frontend

Dans un autre terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend: `http://localhost:3000`

## 4. Gemini

Le backend cherche d'abord la clé enregistrée dans le café, puis utilise `GEMINI_API_KEY`.

Pour utiliser l'assistant sans enregistrer une clé en base:

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_VISION_MODEL=gemini-3.8-flash
```

Une clé peut aussi être enregistrée depuis Réglages.

## 5. Base de données

Après modification du schéma Prisma:

```bash
npx prisma migrate dev --name your_change
npx prisma generate
```

Pour inspecter la DB:

```bash
npx prisma studio
```

## 6. Production

### Railway backend

- Créez un service Railway pour `backend/`.
- Ajoutez PostgreSQL.
- Configurez les variables:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `GEMINI_API_KEY` (optionnel si la clé est configurée dans l'application)
  - `GEMINI_MODEL`
  - `GEMINI_VISION_MODEL`
  - `FRONTEND_URL`
  - `PORT`
  - `NODE_ENV=production`
- Le `railway.json` fournit la commande de build/start.

### Netlify frontend

- Déployez `frontend/`.
- Configurez:
  - `NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app`
- Le `netlify.toml` est inclus.

## 7. Sécurité

- Les mots de passe sont hashés avec bcrypt 12 rounds.
- Les routes API sont protégées par JWT sauf `/auth/login`.
- La clé Gemini enregistrée en DB n'est jamais renvoyée au frontend.
- Les actions qui modifient les données passent par une confirmation côté chat.
- Les données envoyées à l'IA sont limitées au contexte nécessaire.
