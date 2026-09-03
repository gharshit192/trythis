# Security & Compliance

State as of 3 Sep 2026, with the gaps named. Fixes are ordered in §Hardening plan; none are implemented by this document.

## Security architecture (current)

- **Auth:** email + password, bcrypt (cost 10), JWT (30-day expiry) in `Authorization: Bearer`; token kept in `localStorage`. OTP flows (reset, email verify) hashed with bcrypt, 15-minute expiry, dev bypass only outside production. Blog admin: separate `AdminUser`, bcrypt, 12-hour HttpOnly cookie, rate-limited login.
- **Authorization:** every data route filters by `userId` from the JWT; public routes are limited to share pages, blog, places read-only.
- **Transport:** HTTPS on Render and Vercel. CORS allowlist + localhost in dev.
- **Rate limiting:** `express-rate-limit` on signup, login, forgot-password, blog admin login. **Not** on saves, uploads, Ask, plans.
- **Uploads:** multer, 10 MB, 10 files, MIME check on `image/(png|jpe?g|webp)` — MIME is client-declared; no magic-byte check; files land in the container's `uploads/` or Cloudinary.
- **URL imports:** user URLs are fetched by axios and by `yt-dlp` (spawned with argument arrays). Timeouts and `maxRedirects` on some providers. **No SSRF guard**: private/loopback/link-local/metadata addresses are not blocked; no protocol allowlist; no response-size cap on generic fetches.
- **Headers:** no `helmet`; no CSP on the API's HTML pages (share, blog).
- **Secrets:** env vars on Render/Vercel; `.env*`, `backend/secrets/` gitignored; the admin password is in the DB (hashed), not in env or repo.
- **Logging:** app logs to stdout (Render); no error tracker; no audit log for admin actions.
- **Dependencies:** no automated audit in CI.

## Hardening plan (in order)

1. **SSRF guard for every server-side fetch** (`utils/safeFetch.js`): resolve the hostname, reject private/loopback/link-local/metadata ranges (IPv4 and IPv6) *after* resolution, allow only `http(s)`, cap redirects (follow manually, re-validate each hop), cap body size (e.g. 5 MB HTML, streaming abort), 10 s timeout, deny non-standard ports. Apply to `fetchSystem`, `articleExtractor`, thumbnail caching, OG fetch; pass `--max-filesize` and no-playlist flags to yt-dlp; never interpolate URLs into a shell.
2. **Upload validation:** sniff magic bytes (`file-type`), re-encode images through sharp (strips metadata, defeats polyglots), reject SVG, cap dimensions, private storage with signed URLs when moved to S3.
3. **helmet** with a CSP for the API's HTML (share/blog pages inline styles → nonce or hashes), `X-Content-Type-Options`, HSTS.
4. **Rate limits** on `/saves` (create), `/uploads`, `/voice`, `/ask`, `/plans`, `/places/:id/save`; per-user AI quotas (see AI cost).
5. **JWT lifetime** to 7 days with silent refresh (`/auth/refresh` exists); on native, store the token in Capacitor Preferences.
6. **Error hygiene:** central error handler that logs details server-side and returns a stable message + code; no stack traces or provider error bodies to clients (partially true today; make it a rule with a test).
7. **Dependency and secret scanning in CI:** `npm audit --audit-level=high`, `gitleaks` on push.
8. **Admin audit log:** who published/edited/deleted a post, when.
9. **Backups:** Atlas continuous backup on prod; quarterly restore drill.

## AI cost and abuse control

Existing: paid-vision monthly cap (`usageCounter`, ADR 0005); STT provider order with free-first; Haiku for extraction and plans. Add: per-user daily caps (e.g. 30 extractions, 50 Ask questions, 10 plans), dedupe identical URLs per user (already: duplicate detection on save) and globally for extraction results (cache by canonical URL for 7 days), input token caps (transcript ≤ 8k tokens, index ≤ 90 saves in Ask), image downscale before vision, retry limit 2, async queue for video jobs (exists), spend dashboard per model.

## Analytics (privacy rules)

Events (spec in `PRODUCT_STRATEGY.md` and `REVENUE_STRATEGY.md`) carry: event name, timestamp, hashed user id, screen, coarse device class, country. They do not carry: precise location, free text the user typed, URLs they saved, or third-party identifiers. Store in Mongo (`events` collection, 180-day TTL) or a privacy-respecting product analytics tool with EU/IN hosting; no ad-tech SDKs in the app.

## Privacy and data protection (DPDP Act 2023 readiness)

Do not buy a "DPDP certificate"; do the assessment. Outcome so far:

**Personal data processed:** account (name, email, password hash), preferences (interests, vibes, budget, company, nudge time), city and — when enabled — foreground location; saved items (URLs, titles, extracted text, transcripts), screenshots and voice recordings (audio kept only where `audioUrl` is set), plans, ratings, notes; push subscriptions; blog admin credentials.

**Purposes:** delivering the service (save, extract, remind, plan), personalisation the user opted into, security, and — later — commerce attribution (aggregate).

**Processors (third parties):** MongoDB Atlas (DB), Render, Vercel (hosting), Cloudinary (media), Anthropic (extraction/Ask/plans), Groq and Sarvam (speech), OpenStreetMap tiles (map view; IP exposure to tile server — consider a proxy/CDN), Resend (email), Google Fonts on share/blog pages, GitHub (cron). List them in the privacy policy with what each receives.

**Consent and notice:** signup shows terms + privacy links (to write); location and notifications are explicit opt-ins already; email verification is optional. Children: 18+ in terms; no age gate beyond that at launch.

**Rights and controls to implement:** account deletion (self-serve, with purge of saves, uploads, subscriptions within 30 days), data export (JSON of saves/plans), correction (profile editable), withdraw consent (location/notifications toggles exist). Retention: audio and screenshots 12 months after last access; analytics 180 days; logs 30 days.

**Breach handling:** named owner, 72-hour internal assessment, user notice where required by the DPDP rules, provider notification paths recorded.

**Documents to produce:** Privacy Policy, Terms, Affiliate disclosure page, this assessment kept current. Cross-border transfers (Anthropic/Groq in the US) are disclosed.

## VAPT

Sequence: hardening plan above → staging environment → VAPT → fix → re-test → production launch at scale. Do it once the architecture stops changing weekly (target: after the Android beta). Scope: API (auth, IDOR across users, upload, URL import/SSRF, rate limits, admin), web app, share/blog pages, Android build (storage, intents, deep links). Use a CERT-In-empanelled auditor if a formal requirement or partner asks for it; otherwise a reputable firm plus continuous scanning.

## Incident handling

Runbook: rotate the affected secret (Render env → redeploy), revoke tokens by bumping `JWT_SECRET`, take the blog admin offline (`/blog/admin` behind a flag), Atlas IP allowlist tightened, post-mortem in `docs/incidents/`.
