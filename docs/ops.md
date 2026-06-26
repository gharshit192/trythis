# Ops — Setup & Deployment

Consolidated from the former `SETUP.md`, `START_HERE.md`, and `DEPLOYMENT.md`.

## Prerequisites

Node.js, MongoDB, Redis, and a Cloudinary account. AI keys: Anthropic (Claude),
optional Gemini, and Google Cloud Vision (service-account JSON) for Hindi OCR.

## Local setup

```bash
# 1. Install (npm workspaces — run at repo root)
npm install

# 2. Configure env (backend)
cp backend/.env.example backend/.env      # then fill in values

# 3. Start infra
docker-compose up                          # MongoDB :27017 + Redis :6379

# 4. Run
cd backend && npm run dev                  # API on :4000 (node --watch)
cd frontend-app && npm run dev             # PWA dev loop
```

`.env.example` is the source of truth for required variables. Add a var there in
the same change you start reading it.

## Key environment variables

```
# Core
NODE_ENV · PORT · DATABASE_URL (Mongo) · REDIS_URL · JWT_SECRET
MONGODB_DB                        # explicit db name (prod: wanna-try). The app
                                  # refuses to start if this resolves to "test".
# AI
ANTHROPIC_API_KEY · GEMINI_API_KEY
GOOGLE_APPLICATION_CREDENTIALS=./secrets/your-vision-key.json
VISION_MONTHLY_LIMIT=700          # cost guard for Cloud Vision (ADR 0005)
# Media
CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET
# Notifications
VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT
SMTP_* · EMAIL_FROM · PUBLIC_BASE_URL
```

Secrets are never committed: `.env`, `.env*.local`, `backend/secrets/`, and
`.vision-usage.json` are gitignored. Rotate any key that leaks.

## Deployment

- Backend deploys to **Vercel** (`vercel.json`, `Procfile`, `Dockerfile`
  available). Set all required env vars in the platform dashboard.
- Use connection pooling for MongoDB in production; serve over HTTPS.
- Post-deploy checklist: health endpoint responds, auth works, a test save
  extracts end-to-end, Web Push delivers, Vision falls back cleanly if billing
  is off.
- Detailed deployment steps and rollback notes are retained in git history
  (formerly `DEPLOYMENT.md`).

## Frontend (Android)

`frontend-app/` is the active Capacitor client. Build the web bundle, then
`npx cap sync` to push it into the Android shell. See `frontend-app/MOBILE_APP.md`
and [ADR 0007](adr/0007-dual-frontend-capacitor-pwa.md).
