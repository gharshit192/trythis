# TryThis - Save It. Find It. Try It.

A comprehensive platform for saving, organizing, and discovering things you want to try - from cafes and restaurants to travel destinations, products, and experiences.

## 🎯 Project Overview

TryThis is a full-stack application with dual product offerings:
- **Web App** (React) - Browser-based interface for full functionality
- **Mobile App** (React Native/Expo) - iOS/Android native experience
- **Backend** (Node.js/Express) - RESTful API with MongoDB

## 📁 Project Structure

```
TryThis/
├── frontend-app/          # React web application
│   ├── src/
│   │   ├── screens/       # 18 UI screens (Login, Home, Collections, etc.)
│   │   ├── api.js         # API service with real backend integration
│   │   ├── theme.css      # Design system with fixed footer
│   │   └── App.js         # Main app component
│   ├── public/
│   └── package.json
│
├── frontend/              # React Native/Expo mobile app
│   ├── src/
│   │   ├── screens/
│   │   ├── services/
│   │   └── theme/
│   └── package.json
│
├── backend/               # Node.js/Express API server
│   ├── src/
│   │   ├── routes/        # API endpoints (auth, saves, collections, search)
│   │   ├── models/        # MongoDB schemas (User, Save, Collection, etc.)
│   │   ├── middleware/    # Authentication & error handling
│   │   ├── services/      # Business logic (extraction, recommendations)
│   │   └── config/        # Database & Redis configuration
│   ├── .env.example
│   └── package.json
│
├── shared/                # Shared code between web and mobile
│   ├── types/
│   └── utils/
│
├── trythis-seed-data/     # Seed data ingestion pipeline
│   └── seed-data/
│       ├── ingest-seeds.js    # Processing pipeline
│       ├── seeds.json         # 50 URLs for testing
│       └── processed-saves.json # Processed metadata
│
├── docs/                  # Documentation
│   ├── api/               # API endpoint docs
│   ├── architecture/      # Tech stack & system design
│   ├── data-models/       # Database schemas
│   ├── features/          # Feature specifications
│   └── systems/           # Fetch system, retention engine
│
├── MONOREPO_STRUCTURE.md  # Monorepo architecture guide
├── ARCHITECTURE.md        # System architecture details
└── docker-compose.yml     # Docker setup for local development
```

See [MONOREPO_STRUCTURE.md](./MONOREPO_STRUCTURE.md) for detailed breakdown.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/gharshit192/trythis.git
   cd TryThis
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend && npm install
   
   # Web app
   cd ../frontend-app && npm install
   
   # Mobile app (optional)
   cd ../frontend && npm install
   ```

3. **Configure environment**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Update with your MongoDB URI and other config
   
   # Mobile (optional)
   cp frontend/.env.example frontend/.env
   ```

4. **Run the applications**
   ```bash
   # Terminal 1: Backend (port 4000)
   cd backend && npm run dev
   
   # Terminal 2: Web app (port 3000)
   cd frontend-app && npm start
   
   # Terminal 3: Mobile app (optional)
   cd frontend && npm start
   ```

## 🎨 Features Implemented

### Web App (18 Screens)
- ✅ Authentication (Login/Signup)
- ✅ Home Feed with saves display
- ✅ Collections management
- ✅ Search functionality
- ✅ Save detail view
- ✅ Quick save modal
- ✅ Notifications
- ✅ User profile
- ✅ Onboarding flow
- ✅ Fixed footer navigation (consistent across all screens)

### Backend API
- ✅ Authentication (JWT tokens)
- ✅ Save CRUD operations
- ✅ Collections management
- ✅ Search with filters
- ✅ Recommendations engine
- ✅ Notifications system
- ✅ Bulk import endpoint for seed data

### Data Processing
- ✅ Seed data ingestion from 50+ URLs
- ✅ Metadata extraction (title, description, image)
- ✅ Entity detection (hashtags, prices, locations)
- ✅ Category classification
- ✅ 41/50 successful full fetches from seed URLs

## 🔧 Recent Updates

### Footer Fixes
- Fixed footer positioning across all 18 screens
- Changed from `position: relative` to `position: fixed`
- Added `padding-bottom: 80px` to all screen content
- Tested consistency across Home, Search, Collections, Profile

### API Integration
- Implemented real backend API calls in frontend
- Added axios-based API service layer
- JWT token management in localStorage
- Error handling and loading states

### Seed Data
- Created 50-URL seed data set
- Built ingestion pipeline with OG tag extraction
- Implemented bulk import endpoint
- Successfully imported 5+ sample items for demo

## 📊 Database Schema

### Collections
- **users** - User accounts and authentication
- **saves** - Individual saved items
- **collections** - User-created collections
- **notifications** - User notifications
- **recommendations** - Personalized suggestions
- **user_behavior** - Analytics & engagement tracking

See [docs/data-models/schema.md](./docs/data-models/schema.md) for detailed schema.

## 🔐 Authentication

- Email/Password signup and login
- JWT tokens stored in localStorage
- Token refresh mechanism
- Protected API routes with middleware

**Test Credentials:**
```
Email: newuser@example.com
Password: Password123
```

## 📚 Documentation

- [MONOREPO_STRUCTURE.md](./MONOREPO_STRUCTURE.md) - Detailed monorepo architecture
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and components
- [docs/api/endpoints.md](./docs/api/endpoints.md) - API endpoint documentation
- [docs/architecture/tech-stack.md](./docs/architecture/tech-stack.md) - Technology choices
- [docs/data-models/schema.md](./docs/data-models/schema.md) - Database schemas

## 🛠️ Tech Stack

### Frontend (Web)
- React 18
- Axios for HTTP requests
- CSS for styling (design tokens)
- React Router for navigation

### Frontend (Mobile)
- React Native
- Expo for development
- Same component structure as web for code sharing

### Backend
- Node.js with Express.js
- MongoDB with Mongoose
- Redis for caching
- JWT for authentication

### DevOps
- Docker & Docker Compose
- GitHub Actions for CI/CD
- Environment-based configuration

## 🧪 Testing

Run tests with:
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend-app && npm test
```

## 🚢 Deployment

See [SETUP.md](./SETUP.md) for deployment instructions.

## 👥 Git Configuration

```bash
git config user.email "gharshit192@gmail.com"
git config user.name "Harshit Gupta"
```

## 📝 Commit History

1. **Initial commit** - TryThis MVP with footer fixes, seed data ingestion, and bulk import
2. **Frontend-app commit** - Updated with footer fixes and real API integration
3. **Submodule update** - Updated frontend-app submodule pointer with latest changes

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Commit with descriptive messages
4. Push and create a pull request

## 📄 License

ISC

## 🙋 Support

For issues or questions, create an issue on the GitHub repository.

---

**Generated with Claude Code** 🤖
