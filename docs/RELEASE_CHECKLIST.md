# Release Checklist

Use before any production release. Copy into the PR description and tick.

## Backend (API on Render)

- [ ] `.env.example` lists every new env var; Render env updated **before** the deploy.
- [ ] No secrets in the diff (`git diff --stat`, gitleaks).
- [ ] Migrations/backfills identified; scripts run with `ENV_FILE=.env.prod-local` by a human, never by the app on boot.
- [ ] Atlas backup point noted; restore path known.
- [ ] `node --check` on changed files; `npm test` in `backend/`.
- [ ] Docs-only commits carry `[skip render]`; one push per feature batch.
- [ ] After deploy: `/status` shows the new commit; `/health` 200; smoke: login, `GET /saves`, one extraction, one `/ask`, blog index.
- [ ] Logs watched for 10 minutes; error rate unchanged.

## Frontend (Vercel / PWA)

- [ ] `CI=true npm run build` passes locally (warnings fail the Vercel build).
- [ ] Service worker version bumped only when the shell changes (`public/sw.js`).
- [ ] Manifest unchanged unless intended (share_target, icons); a share_target change needs users to reinstall the PWA.
- [ ] Headless screenshots of touched screens reviewed.
- [ ] Hard-reload check on the deployed URL; installed-PWA check on a phone.

## Android (Capacitor)

- [ ] `appId` final (`com.wannatry.app`) and `versionCode` bumped.
- [ ] `npm run build && npx cap sync android`; release built with the upload key from a secure keystore (not in repo).
- [ ] Permissions in the manifest match what the release uses; Play Data safety form updated.
- [ ] Share intent tested from Instagram, YouTube, Chrome, WhatsApp (URL, text, image, multiple images).
- [ ] Deep links tested installed and not installed (`assetlinks.json` live).
- [ ] Push: token registration, one test notification, tap opens the right screen.
- [ ] Login, first save, screenshot import, offline banner, hardware back.
- [ ] Crash/ANR monitoring wired (Play Console + Sentry).
- [ ] Track: internal → closed (≥ 20 testers, 14 days per Play policy for new personal accounts) → production staged rollout 10% → 50% → 100%.
- [ ] Privacy policy URL and terms linked in the listing and in-app.

## Compliance

- [ ] Privacy policy and terms published and versioned; changes noted in-app.
- [ ] Data protection assessment (`SECURITY_COMPLIANCE.md`) reviewed for new data or processors.
- [ ] Affiliate disclosure page present if any commercial zone ships.
- [ ] VAPT status: not started / scheduled / findings fixed (date).
- [ ] Account deletion and export paths verified.

## Rollback

- Backend: redeploy the previous commit from Render (Deploys → Rollback) or `git revert` + push.
- Frontend: Vercel → Deployments → promote previous.
- Android: halt the staged rollout; publish a fixed build; server-side flags for risky features so a rollback rarely needs a store release.
