# TryThis Monorepo Structure

This document describes the complete monorepo structure for the TryThis project.

## Overview

TryThis is organized as a monorepo containing backend, frontend, and shared code:

```
TryThis/
├── backend/                # Node.js/Express API
├── frontend/               # React Native + Expo app
├── shared/                 # Shared types and utilities
├── docs/                   # Documentation
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Local development stack
├── package.json            # Workspace root
└── README.md               # Project overview
```

## Directory Structure

### `/backend` - Node.js/Express API

```
backend/
├── src/
│   ├── server.js           # Entry point
│   ├── app.js              # Express app setup
│   ├── config/
│   │   ├── database.js     # MongoDB connection
│   │   └── redis.js        # Redis client
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   └── errorHandler.js # Global error handling
│   ├── routes/
│   │   ├── index.js        # Route aggregation
│   │   ├── auth.js         # Authentication endpoints
│   │   ├── saves.js        # Save CRUD endpoints
│   │   ├── collections.js  # Collection endpoints
│   │   ├── search.js       # Search endpoint
│   │   ├── recommendations.js # Recommendation endpoint
│   │   └── notifications.js # Notification endpoints
│   ├── services/
│   │   ├── fetchSystem/
│   │   │   ├── index.js
│   │   │   └── handlers/
│   │   │       ├── urlHandler.js
│   │   │       ├── instagramHandler.js
│   │   │       └── screenshotHandler.js
│   │   ├── extractionEngine/
│   │   │   └── index.js     # Entity extraction & classification
│   │   ├── retentionEngine/
│   │   │   └── index.js     # Behavioral tracking & triggers
│   │   └── recommendationEngine/
│   │       └── index.js     # Recommendation generation
│   ├── models/
│   │   ├── User.js          # User schema
│   │   ├── Save.js          # Save schema
│   │   ├── Collection.js    # Collection schema
│   │   ├── Recommendation.js # Recommendation schema
│   │   ├── Notification.js  # Notification schema
│   │   └── UserBehavior.js  # Behavioral tracking schema
│   ├── utils/
│   │   └── logger.js        # Logging utility
│   └── data/
│       └── mockData.js      # Mock data for development
├── package.json
├── .env.example
├── Dockerfile
└── README.md
```

### `/frontend` - React Native + Expo

```
frontend/
├── App.js                  # Root component
├── src/
│   ├── navigation/
│   │   └── RootNavigator.js # Bottom tab navigation
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── SearchScreen.js
│   │   ├── SaveDetailScreen.js
│   │   ├── CollectionsScreen.js
│   │   ├── SavesScreen.js
│   │   ├── QuickSaveScreen.js
│   │   └── ProfileScreen.js
│   ├── components/
│   │   ├── SaveCard.js
│   │   ├── CollectionCard.js
│   │   ├── Chip.js
│   │   └── SearchBar.js
│   ├── services/
│   │   ├── api.js          # API client
│   │   └── storage.js      # Local storage
│   ├── store/
│   │   └── appStore.js     # Zustand store (state management)
│   ├── theme/
│   │   ├── colors.js
│   │   └── spacing.js
│   └── utils/
│       ├── validators.js
│       └── formatters.js
├── images/                 # Screenshots & assets
├── package.json
├── .env.example
├── app.json
└── README.md
```

### `/shared` - Shared Code

```
shared/
├── types/
│   └── api.ts              # TypeScript interfaces for API contracts
└── utils/
    ├── constants.ts        # Shared constants
    └── apiHelpers.ts       # Shared API helpers
```

### `/docs` - Documentation

```
docs/
├── architecture/
│   └── overview.md         # Architecture overview
├── systems/
│   ├── fetch-system.md     # Data ingestion pipeline
│   ├── retention-engine.md # Behavioral system & triggers
│   └── extraction-engine.md # Metadata extraction
├── api/
│   └── endpoints.md        # API endpoint documentation
├── data-models/
│   └── schema.md           # MongoDB schema details
├── features/
│   └── mobile-tech-stack.md # Mobile development guide
├── STRATEGIC-INSIGHTS.md   # Product strategy & moat
└── IMPLEMENTATION-GUIDE.md # Implementation roadmap
```

## Development Workflow

### Local Setup

```bash
# Clone repository
git clone <repo-url>
cd TryThis

# Install root dependencies (workspace management)
npm install

# Start all services (MongoDB, Redis, Backend, Frontend)
docker-compose up

# Or run individually
npm run dev:backend   # Start backend server
npm run dev:frontend  # Start React Native dev server
```

### Configuration

1. **Backend Configuration**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Frontend Configuration**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your settings
   ```

## API Endpoints

### Authentication
- `POST /auth/signup` — Register user
- `POST /auth/login` — Login user
- `POST /auth/refresh` — Refresh token

### Saves
- `POST /saves` — Create new save
- `GET /saves` — Get user's saves
- `GET /saves/:id` — Get single save
- `PATCH /saves/:id` — Update save
- `DELETE /saves/:id` — Delete save

### Collections
- `POST /collections` — Create collection
- `GET /collections` — Get user's collections
- `GET /collections/:id` — Get collection details
- `POST /collections/:id/saves/:saveId` — Add save to collection
- `DELETE /collections/:id/saves/:saveId` — Remove save from collection

### Search & Recommendations
- `GET /search?q=...&category=...` — Search saves
- `GET /recommendations/:saveId` — Get recommendations

### Notifications
- `GET /notifications` — Get user's notifications
- `PATCH /notifications/:id` — Mark as read
- `POST /notifications/:id/dismiss` — Dismiss notification

## Database Schema

### Collections
- **users** — User accounts and preferences
- **saves** — Saved content items
- **collections** — User-created collections
- **recommendations** — Generated recommendations
- **notifications** — User notifications
- **user_behaviors** — Behavioral analytics

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB
- **Cache/Queue:** Redis + Bull
- **Authentication:** JWT
- **Data Fetching:** Axios, Cheerio, OGS
- **Logging:** Custom logger utility

### Frontend
- **Framework:** React Native + Expo
- **State Management:** Zustand
- **API Client:** Axios + React Query
- **UI Components:** React Native Paper
- **Storage:** AsyncStorage

### Shared
- **Language:** TypeScript
- **Type Safety:** Strict mode enabled

### DevOps
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Container Registry:** Docker Hub

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git commit -m "feat: description"

# Push and create PR
git push origin feature/feature-name
```

## Environment Variables

### Backend (`.env`)
```
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/trythis
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
LOG_LEVEL=debug
```

### Frontend (`.env`)
```
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

## Next Steps

1. **Backend Integration**
   - Implement database connection pooling
   - Add request validation middleware
   - Create Bull queue workers for async tasks
   - Implement caching strategy

2. **Frontend Integration**
   - Setup API client with authentication
   - Implement state management store
   - Create authentication screens
   - Wire components to API endpoints

3. **Features to Build**
   - User authentication UI
   - Save/edit/delete flows
   - Collection management
   - Search and filtering
   - Recommendation display
   - Notification system
   - Behavioral tracking

4. **Production Ready**
   - Add comprehensive error handling
   - Implement logging and monitoring
   - Setup database backups
   - Configure CDN for assets
   - Implement rate limiting
   - Add CORS security headers
