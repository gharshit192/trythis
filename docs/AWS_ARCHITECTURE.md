# Cloud Architecture — today, and the AWS path

## Today (facts)

| Layer | Service | Notes |
|---|---|---|
| API | **Render** web service, Docker (`Dockerfile` at repo root) | Free tier: sleeps after 15 min idle; ~10 min deploys after the `.dockerignore` fix |
| Frontend | **Vercel** (CRA build, SPA rewrites) | `trythis-frontend.vercel.app` |
| Database | **MongoDB Atlas** | one cluster; no backups configured beyond Atlas defaults |
| Media | **Cloudinary** (+ local `uploads/` on the container, ephemeral) | thumbnails cached, screenshots |
| Jobs | in-process worker + notification scheduler; **GitHub Actions** cron drives notifications (3×/day) and keepalive | scheduler cannot fire while Render sleeps |
| AI | Anthropic Claude (Haiku for extraction/plans, Sonnet for memory/Ask), Groq + Sarvam STT, whisper.cpp fallback, Tesseract OCR | keys in Render env |
| Email | Resend (REST) — **not configured on production yet** | `/status` shows the provider |
| Push | Web Push (VAPID) | FCM later for Android |
| Secrets | Render env vars; `.env*` gitignored | no secret manager |
| Monitoring | Render logs only | no error tracking, no uptime alerts |

Note: `docs/ops.md` still says the backend deploys to Vercel; Render is the truth and `ops.md` should be corrected with this doc.

## Principle

Simple · low cost · secure · scalable enough. No Kubernetes, microservices, event buses, multi-region, or extra databases until a number forces them.

## Decision: stay on Render/Vercel/Atlas for now, plan AWS behind credits

Moving to AWS today buys nothing the product needs and costs a week. The one problem worth money now is the cold start, and it is solved by **Render Starter ($7/month)**. AWS becomes worth it when either (a) AWS Activate credits are approved, or (b) monthly infra spend passes ~$50 or media/egress grows.

### AWS Activate

Apply through the Activate Founders tier (no VC required; up to $1k, then more via accelerator/partner tiers). Needs: a company/website, a short description, the AWS account. Treat credits as infrastructure credits with a clock, not cash; design the same simple architecture either way.

## Target AWS architecture (when the trigger fires)

```
Route 53 (wannatry domain)
  ├── CloudFront → S3            static frontend (or keep Vercel — fine either way)
  └── CloudFront → ALB → App Runner (or ECS Fargate, 1 service, 1–2 tasks)   the API container
                             ├── MongoDB Atlas (stay; or DocumentDB only if Atlas cost forces it)
                             ├── S3 (private bucket) for screenshots/uploads, signed URLs, lifecycle rules
                             ├── Secrets Manager / SSM Parameter Store for keys
                             ├── EventBridge Scheduler → cron endpoints (replaces GitHub Actions cron)
                             ├── CloudWatch logs + alarms, AWS Budgets
                             └── SES for email (or keep Resend)
```

- **Compute:** App Runner runs the existing Docker image with autoscaling and no cold sleep; simplest path from Render. ECS Fargate if App Runner's CPU limits hurt video jobs.
- **Storage:** S3 private bucket replaces the ephemeral `uploads/` dir; Cloudinary stays for transforms only if still needed.
- **Environments:** `dev` (local, seeded), `staging` (App Runner service + Atlas staging DB), `prod`. Never run local against prod (`.env.prod-local` exists for read-only checks; the worker/media guards stay on).
- **Backups:** Atlas continuous backup on prod; S3 versioning; weekly restore test.
- **Monitoring:** CloudWatch alarms on 5xx rate, p95 latency, task restarts; Sentry (free tier) for app errors on both API and frontend; uptime check on `/health`.
- **Cost controls:** AWS Budgets alert at 50/80/100% of the monthly figure; AI spend tracked per model in `usageCounter` (exists) and surfaced in the admin.

## Cost view (monthly, rough)

| Item | Now | AWS target |
|---|---|---|
| API compute | $0 (free) → $7 Starter | App Runner ~$15–30 |
| Frontend | $0 | $0–5 |
| Atlas | $0 (M0) → M10 ~$60 when needed | same |
| Media | $0 | S3 + CloudFront < $5 |
| AI | variable (largest): Haiku extraction ~₹0.5–2 per reel, Sonnet Ask ~₹1–3 per question | same |
| Email/push | $0 | $0–1 |

The AI line is the one to watch; controls are in `SECURITY_COMPLIANCE.md` §AI cost.

## Scaling strategy

Vertical first (bigger App Runner instance), then a second task behind the ALB. The video/STT pipeline is the CPU hog: move it to a separate worker service (same image, `WORKER_ONLY=true`) before adding API replicas. Mongo indexes exist for the hot paths (userId+status, resurfaceAt, place geo box); add read-preference secondaries before sharding.
