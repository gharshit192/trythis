# TryThis Development Setup Guide

Complete guide to set up and run the TryThis monorepo locally.

## Prerequisites

- **Node.js** 18+ (download from https://nodejs.org)
- **Docker** and **Docker Compose** (for MongoDB and Redis)
- **Git** for version control
- **npm** or **yarn** for package management

## Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone <repository-url>
cd TryThis

# 2. Install dependencies
npm install

# 3. Setup environment variables
cd backend && cp .env.example .env && cd ..
cd frontend && cp .env.example .env && cd ..

# 4. Start services
docker-compose up

# In another terminal:
npm run dev

# Backend runs at: http://localhost:3000
# Frontend runs at: http://localhost:8081 (Expo)
```

## Detailed Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd TryThis
```

### 2. Install Root Dependencies

The root `package.json` uses npm workspaces. Install all dependencies:

```bash
npm install
```

This installs dependencies for:
- `/backend/package.json`
- `/frontend/package.json`

### 3. Configure Environment Variables

**Backend**

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/trythis
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-change-in-production
LOG_LEVEL=debug
```

**Frontend**

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true
NODE_ENV=development
```

### 4. Start Services

#### Option A: Docker Compose (Recommended)

Start all services: MongoDB, Redis, Backend, Frontend

```bash
docker-compose up
```

Services:
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379
- **Backend API:** http://localhost:3000
- **Frontend:** Expo app (scan QR code in terminal)

#### Option B: Manual Setup (if Docker not available)

**Start MongoDB:**
```bash
mongod
# Runs on localhost:27017
```

**Start Redis:**
```bash
redis-server
# Runs on localhost:6379
```

**Start Backend:**
```bash
cd backend
npm run dev
# Runs on localhost:3000
```

**Start Frontend:**
```bash
cd frontend
npm start
# Scan QR code with Expo Go app
```

### 5. Verify Setup

**Test Backend:**
```bash
curl http://localhost:3000/health
# Expected response: { status: 'ok', message: 'TryThis API is running' }
```

**Test Frontend:**
- Open Expo Go app on phone
- Scan QR code from terminal
- App should load without errors

## Available Scripts

### Root Level

```bash
npm run dev              # Start all services (requires docker-compose)
npm run dev:backend     # Start backend only
npm run dev:frontend    # Start frontend only
npm run test:backend    # Run backend tests
npm run test:frontend   # Run frontend tests
npm run lint:backend    # Lint backend code
npm run lint:frontend   # Lint frontend code
```

### Backend Only

```bash
cd backend

npm run dev             # Development server with auto-reload
npm run start           # Production server
npm run test            # Run tests
npm test -- --watch    # Run tests in watch mode
npm run lint            # Run ESLint
npm run seed            # Seed database with mock data
```

### Frontend Only

```bash
cd frontend

npm start               # Start Expo dev server
npm run android        # Build for Android
npm run ios            # Build for iOS
npm run web            # Run web version
npm test               # Run tests
npm run lint            # Run ESLint
```

## Database Setup

### MongoDB

The database is automatically initialized by Docker Compose.

To seed mock data:

```bash
cd backend
npm run seed
```

To reset database:

```bash
docker-compose down -v  # -v removes volumes
docker-compose up       # Recreate empty database
```

### Redis

Redis is used for caching and Bull queue. No manual setup needed.

## Testing

### Backend Tests

```bash
cd backend
npm test                      # Run all tests once
npm test -- --watch         # Run in watch mode
npm test -- --coverage      # Generate coverage report
```

### Frontend Tests

```bash
cd frontend
npm test -- --watchAll      # Run in watch mode
npm test -- --coverage      # Generate coverage report
```

## Debugging

### Backend Debugging

Enable debug logs:
```bash
# In .env
LOG_LEVEL=debug
```

Or via environment variable:
```bash
LOG_LEVEL=debug npm run dev
```

Watch MongoDB operations:
```bash
docker-compose exec mongodb mongosh
# Then in MongoDB shell
db.setLogLevel(0)  # More verbose
```

### Frontend Debugging

**React Native Debugger:**
```bash
# Install globally
npm install -g react-native-debugger

# Open the debugger
react-native-debugger

# In your React Native app, shake device → "Debug JS Remotely"
```

**Console Logs:**
```bash
# View logs from Expo
npm run dev 2>&1 | grep -E "ERROR|WARN|LOG"
```

## Common Issues

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
```bash
# Check if MongoDB is running
docker-compose ps

# If not running:
docker-compose up mongodb
```

### Redis Connection Error

```
Error: Error: ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if Redis is running
docker-compose ps

# If not running:
docker-compose up redis
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in backend .env
PORT=3001
```

### npm Install Fails

```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## IDE Setup

### VS Code

**Recommended Extensions:**
- ESLint
- Prettier - Code formatter
- Thunder Client (API testing)
- MongoDB for VS Code
- React Native Tools

**.vscode/settings.json:**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "eslint.validate": ["javascript", "javascriptreact"],
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### WebStorm / IntelliJ

- File → Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint (enable)
- File → Settings → Languages & Frameworks → JavaScript → Prettier (enable)

## Git Workflow

### Create Feature Branch

```bash
git checkout -b feature/feature-name
```

### Commit Changes

```bash
git add .
git commit -m "feat: description of changes"
```

### Push and Create PR

```bash
git push origin feature/feature-name
# Then create PR on GitHub
```

### Squash Before Merge

```bash
git rebase -i main
# Mark commits as "squash" or "s"
git push --force-with-lease
```

## Deployment

### Build Backend Image

```bash
docker build -t trythis-backend:latest ./backend
```

### Build Frontend APK (Android)

```bash
cd frontend
eas build --platform android
```

### Build Frontend IPA (iOS)

```bash
cd frontend
eas build --platform ios
```

See `.github/workflows/deploy.yml` for CI/CD pipeline setup.

## Documentation

- **Architecture:** `docs/architecture/overview.md`
- **Fetch System:** `docs/systems/fetch-system.md`
- **Retention Engine:** `docs/systems/retention-engine.md`
- **API Endpoints:** `docs/api/endpoints.md`
- **Data Models:** `docs/data-models/schema.md`
- **Monorepo Structure:** `MONOREPO_STRUCTURE.md`

## Getting Help

1. Check the documentation in `/docs`
2. Review error logs: `docker-compose logs -f`
3. Check MongoDB: `docker-compose exec mongodb mongosh`
4. Check Redis: `docker-compose exec redis redis-cli`

## Next Steps

1. ✅ Setup complete
2. Create your first save (test the happy path)
3. Build out authentication UI
4. Implement API integration
5. Add behavioral tracking

Happy coding! 🚀
