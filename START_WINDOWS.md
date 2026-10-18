# Windows start — Saraya Assistant

Use Node.js 20 LTS (recommended for this Next.js 14 project). Do not use Node 24 for this build.

1. Copy `backend/.env.example` to `backend/.env` and insert your existing DATABASE_URL, JWT_SECRET and Gemini API key.
2. Backend PowerShell:
   `cd backend`
   `npm install`
   `npm run dev`
3. Frontend in a second PowerShell:
   `cd frontend`
   `npm install`
   `npm run dev`

If an old/corrupt install exists, delete `node_modules` first and reinstall. Do not run `npm audit fix --force` without retesting the application.
