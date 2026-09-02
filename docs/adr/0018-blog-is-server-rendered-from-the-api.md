# ADR 0018 — The blog is server-rendered by the API, written from a web admin

**Status:** Accepted · 2026-09-02

## Context

We want search traffic: people typing "save instagram reels", "bill reminder
app india", "kasol trip plan". The app is a client-rendered SPA on Vercel —
crawlers get an empty shell. And the person writing posts is one admin, daily,
from a laptop, not an app user.

## Decision

1. **Server-rendered on the API** (`backend/src/routes/blog.js`,
   `services/blogPage.js`): `/blog`, `/blog/:slug`, `/blog/sitemap.xml`,
   `/blog/feed.xml`, `/robots.txt`. Full HTML with canonical, Open Graph and
   JSON-LD `BlogPosting`, cached 5 minutes. Same design language as the share
   page (ADR 0012 tokens), laid out for desktop reading.
2. **Posts are Markdown in Mongo** (`models/Post.js`); the rendered HTML is
   stored at save time so a page is one read. Keywords drive the eyebrow, the
   chips, and "keep reading" (overlap ranking).
3. **One admin account, in the database** (`models/AdminUser.js`) — never an
   app user, no env, no secret in the repo. The first sign-in with the
   bootstrap email (`wannatry@admin.com`, a constant in `routes/blog.js`)
   creates the account with the password typed, bcrypt-hashed; after that it
   is a normal login with change-password. The web admin at `/blog/admin` is a
   login + two-pane writer (list, editor), plain forms, a 12-hour HttpOnly
   cookie signed with `JWT_SECRET`, login rate-limited. Drafts preview with
   `?preview=1` while signed in.
4. **Every post ends in the same block**: the app, Android install steps,
   iPhone "Add to Home Screen" steps. The blog exists to move readers into the
   app; the block is not optional.

## Consequences

- SEO lives on the API's domain until a custom domain is mapped (recommended:
  `wannatry.app` → Vercel, `api.wannatry.app` → Render, and the blog reached at
  `wannatry.app/blog` via a Vercel rewrite to the API). Until then links are
  `BASE_URL/blog`.
- `seeds/blogPosts.js` upserts the launch posts by slug; safe to re-run.
- Later: images via the assets store, categories, scheduled publishing, an
  "as seen in the app" embed of a real save.
