# TryThis Deployment Guide

## Production Deployment (Vercel)

### Environment Variables Required

Add these to Vercel Project Settings → Environment Variables:

```
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/database
REDIS_URL=redis://user:password@host:port
JWT_SECRET=your-secret-key-min-32-chars
NODE_ENV=production
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-password
EMAIL_FROM=noreply@trythis.app
PUBLIC_BASE_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

### Critical Settings

**Memory:** 1024 MB (required for Node.js + MongoDB connection pooling)
**Function timeout:** 30 seconds (Vercel max)
**Build command:** `npm install --prefix backend`

### Deployment Steps

1. **Push to GitHub:**
   ```bash
   git push origin feature/category-wise-extraction
   ```

2. **Connect to Vercel:**
   - Go to vercel.com/dashboard
   - Click "Add New" → "Project"
   - Import from GitHub
   - Select the repository
   - Build settings will auto-detect (uses vercel.json)

3. **Set Environment Variables in Vercel:**
   - Project Settings → Environment Variables
   - Paste all variables above
   - **Important:** Mark `DATABASE_URL` and `JWT_SECRET` as sensitive

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete (2-3 min)
   - Test with: `curl https://your-domain.com/health`

### What the Fix Does

**Problem:** MongoDB connection was timing out before requests arrived (serverless cold start)

**Solution:** Lazy initialization middleware
- First request waits for database connection
- Subsequent requests use cached connection
- Health checks bypass initialization (fast response)
- Error responses if initialization fails

**Code flow:**
```
Request arrives
    ↓
Check if database connected
    ↓ NO: Wait for connection (max 10 sec)
    ↓ YES: Proceed to route handler
```

### Testing Production Locally

```bash
NODE_ENV=production node backend/src/server.js
```

Should show:
```
[Init] NODE_ENV: production
✅ Database connected
✅ Redis connected
```

### Monitoring in Production

**Health check:** `GET /health` (200 = working)
**Status endpoint:** `GET /status` (shows env vars, db url)
**Error logs:** Vercel Dashboard → Function Logs

### Common Issues

**"Operation buffering timed out"**
- ✅ Fixed by this deployment
- Cause: DB connection not ready before request
- Solution: Middleware waits for initialization

**"Cannot read property 'lastActiveAt' of null"**
- Check DATABASE_URL is correct
- Verify MongoDB network access allows Vercel IPs
- Add `0.0.0.0/0` to MongoDB IP whitelist (or specific Vercel ranges)

**"Redis not available"**
- ✅ Non-blocking: app continues without Redis
- Analytics still works (MongoDB fallback)
- Rate limiting disabled without Redis
- Acceptable for MVP

**"CORS error from frontend"**
- Update `PUBLIC_BASE_URL` to your Vercel domain
- Verify frontend points to correct API URL
- Frontend should use environment variable for API_URL

### Database Connection Pooling

MongoDB connection pool settings (in DATABASE_URL):
```
mongodb+srv://user:password@cluster.mongodb.net/database?
  maxPoolSize=5&
  minPoolSize=2&
  retryWrites=true&
  w=majority
```

Add these parameters to DATABASE_URL if connection pooling is needed.

### SSL/HTTPS

Vercel auto-generates SSL certificate for your domain. No setup needed.

### Frontend Deployment

Frontend can be deployed to:
1. **Vercel (same project)**
   - Create separate build config for frontend-app
   - Link to backend API

2. **Netlify / GitHub Pages**
   - Build: `npm run build`
   - Deploy dist/ folder
   - Set API_URL env var to point to backend

3. **Docker (optional)**
   - Backend already has Dockerfile
   - Frontend: create Dockerfile with Node + serve

### Post-Deployment Checklist

- [ ] `GET /health` returns 200
- [ ] `GET /status` shows all env vars SET
- [ ] User signup works (check MongoDB Compass)
- [ ] Login works (JWT token generated)
- [ ] POST /auth/ping records sessions
- [ ] Analytics: `db.users.find({ sessionCount: { $gt: 0 } })` shows sessions

### Rollback

If something breaks in production:

1. **Quick rollback (< 5 min):**
   - Vercel Dashboard → Deployments → Select previous version
   - Click "Redeploy"

2. **Check logs:**
   ```bash
   vercel logs --follow
   ```

3. **Debugging:**
   - Check `GET /status` output
   - Verify all env vars are set
   - Test locally first

---

**Last updated:** 2026-05-22
**Backend:** Node.js + Express + MongoDB
**Hosting:** Vercel Serverless Functions
