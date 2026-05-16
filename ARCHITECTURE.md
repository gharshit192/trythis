# TryThis Architecture & Monorepo Structure

## 📋 Overview

TryThis is a **dual-platform application** with separate web and mobile versions that share core business logic:

- 🌐 **React Web App** - Browser-based (desktop, tablet, mobile browser)
- 📱 **React Native/Expo App** - Native iOS/Android applications
- 🔗 **Shared Package** - Common API, hooks, utilities, state management
- 🖥️ **Backend API** - Node.js/Express server on port 4000

Both apps coexist and serve different user preferences while maintaining code consistency.

---

## 🏗️ Folder Structure (Monorepo)

```
TryThis/
│
├── packages/
│   └── shared/                          ⭐ SHARED CODE (Future Setup)
│       ├── src/
│       │   ├── api/
│       │   │   └── index.js            (API calls & axios setup)
│       │   ├── hooks/
│       │   │   ├── useAuth.js          (Authentication logic)
│       │   │   ├── useSaves.js         (Saves data fetching)
│       │   │   ├── useCollections.js   (Collections logic)
│       │   │   └── useSearch.js        (Search logic)
│       │   ├── context/
│       │   │   ├── AuthContext.js      (Auth state)
│       │   │   └── AppContext.js       (Global app state)
│       │   ├── utils/
│       │   │   ├── storage.js          (Local storage helpers)
│       │   │   ├── validators.js       (Form validation)
│       │   │   └── helpers.js          (Utility functions)
│       │   ├── types/
│       │   │   └── index.ts            (TypeScript interfaces)
│       │   ├── constants/
│       │   │   ├── api.js              (API endpoints)
│       │   │   ├── messages.js         (Error/success messages)
│       │   │   └── config.js           (App configuration)
│       │   └── index.js                (Barrel exports)
│       ├── package.json
│       └── README.md
│
├── frontend-app/                        (React Web Application)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── HomeFeed.jsx
│   │   │   ├── Collections.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── ... (other screens)
│   │   ├── components/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   └── ... (UI components)
│   │   ├── api.js                      (Current: will move to shared)
│   │   ├── theme.css
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── frontend/                            (React Native/Expo Application)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js
│   │   │   ├── SignupScreen.js
│   │   │   ├── HomeScreen.js
│   │   │   ├── CollectionsScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   └── ... (other screens)
│   │   ├── components/
│   │   │   ├── Button.js
│   │   │   ├── TextInput.js
│   │   │   └── ... (React Native components)
│   │   ├── services/
│   │   │   ├── api.js                  (Current: will move to shared)
│   │   │   └── storage.js              (Current: will move to shared)
│   │   ├── navigation/
│   │   │   └── RootNavigator.js
│   │   ├── theme/
│   │   │   ├── colors.js
│   │   │   └── spacing.js
│   │   ├── App.js
│   │   └── index.js
│   ├── app.json
│   ├── package.json
│   └── README.md
│
├── backend/                             (Node.js/Express API)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── saves.js
│   │   │   ├── collections.js
│   │   │   └── ...
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── README.md
│
├── trythis-seed-data/                   (Seed Data for Testing)
│   └── seed-data/
│       ├── seeds.json                   (50+ test URLs with metadata)
│       ├── ingest-seeds.js              (Script to process seed data)
│       ├── processed-saves.json         (Output: processed seed data)
│       └── README.md
│
├── shared/                              (Shared documentation)
│   ├── API_SPEC.md
│   └── DATA_MODELS.md
│
├── docs/
│   ├── SETUP.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│
├── package.json                         (Workspace root - future)
├── ARCHITECTURE.md                      (This file)
├── MONOREPO_STRUCTURE.md               (Existing)
├── README.md
└── .gitignore
```

---

## 🔄 Code Sharing Strategy

### What Gets Shared (in `packages/shared`)

| Category | Items | Shared? |
|----------|-------|---------|
| **API Layer** | API calls, axios setup, endpoints | ✅ YES |
| **Custom Hooks** | useAuth, useSaves, useCollections, etc | ✅ YES |
| **State Management** | Context API, reducers, global state | ✅ YES |
| **Utilities** | Storage, validators, helpers, formatters | ✅ YES |
| **Constants** | API endpoints, messages, config | ✅ YES |
| **Types/Interfaces** | TypeScript definitions | ✅ YES |
| **UI Components** | Buttons, Inputs, Cards (visual design) | ❌ NO |
| **Styling** | CSS, StyleSheet, themes | ❌ NO |
| **Navigation** | React Router (web) vs React Navigation (mobile) | ❌ NO |
| **Platform-Specific** | Device APIs, native features | ❌ NO |

---

## 📁 Shared Package Details

### `packages/shared/src/api/index.js`
```javascript
// Shared across both web and mobile
// Single source of truth for all API calls

export const signup = (email, password, name) => { ... }
export const login = (email, password) => { ... }
export const getSaves = () => { ... }
export const getCollections = () => { ... }
// ... etc
```

### `packages/shared/src/hooks/useAuth.js`
```javascript
// Custom hook that both apps import
// Business logic only - no UI

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const login = async (email, password) => { ... }
  const logout = () => { ... }
  
  return { user, loading, login, logout };
}
```

---

## 🌐 Frontend App (Web)

**Technology:** React, HTML, CSS  
**Port:** 3000  
**Target:** Desktop, tablet, mobile browsers

### Structure
```
frontend-app/
├── src/
│   ├── screens/          (Page components)
│   ├── components/       (Reusable UI components)
│   ├── App.js           (Main router)
│   ├── api.js           (Will import from @shared/api)
│   └── theme.css        (Web styling)
└── package.json         (depends on @shared)
```

### Usage Example
```javascript
// frontend-app/src/screens/LoginScreen.jsx
import { useAuth } from '@shared/hooks';

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = () => {
    login(email, password);
  };
  
  return (
    <div className="login-container">
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>{loading ? 'Loading...' : 'Sign In'}</button>
    </div>
  );
}
```

---

## 📱 Frontend App (Mobile/Expo)

**Technology:** React Native, Expo  
**Port:** 8081  
**Target:** iOS and Android devices

### Structure
```
frontend/
├── src/
│   ├── screens/         (Mobile screens)
│   ├── components/      (React Native components)
│   ├── navigation/      (React Navigation setup)
│   ├── services/        (Will import from @shared)
│   └── theme/          (Mobile styling)
└── package.json        (depends on @shared)
```

### Usage Example
```javascript
// frontend/src/screens/LoginScreen.js
import { useAuth } from '@shared/hooks';
import { View, TextInput, Pressable, Text } from 'react-native';

export default function LoginScreen({ navigation }) {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = async () => {
    await login(email, password);
    // Same login logic as web!
  };
  
  return (
    <View style={styles.container}>
      <TextInput value={email} onChangeText={setEmail} />
      <TextInput value={password} onChangeText={setPassword} />
      <Pressable onPress={handleLogin}>
        <Text>{loading ? 'Loading...' : 'Sign In'}</Text>
      </Pressable>
    </View>
  );
}
```

---

## 🖥️ Backend (API Server)

**Technology:** Node.js, Express, MongoDB  
**Port:** 4000

### Key Endpoints
```
POST   /auth/signup           Create new user
POST   /auth/login            User login
POST   /auth/refresh          Refresh token

GET    /saves                 Get all saves
POST   /saves                 Create save
GET    /saves/:id             Get save detail
PATCH  /saves/:id             Update save
DELETE /saves/:id             Delete save

GET    /collections           Get all collections
POST   /collections           Create collection
GET    /collections/:id       Get collection detail
POST   /collections/:id/saves/:saveId    Add save to collection
```

See `backend/src/routes/` for full implementation.

---

## 🔐 Authentication Flow

Both apps use the same authentication mechanism:

```
User Input (Web or Mobile)
    ↓
Shared useAuth Hook
    ↓
Shared API Call (@shared/api.login)
    ↓
Backend Validation & JWT Token
    ↓
Shared Storage (localStorage/AsyncStorage)
    ↓
Both Apps: Authenticated ✅
```

---

## 🔄 Development Workflow

### Current State (Before Monorepo)
```
Web App changes      →  Manually sync  →  Mobile App
Mobile App changes   →  Manually sync  →  Web App
(DUPLICATE CODE - BAD)
```

### Ideal State (After Monorepo)
```
Update @shared/api   →  Both apps automatically use it ✅
Update @shared/hooks →  Both apps automatically use it ✅
(SINGLE SOURCE OF TRUTH - GOOD)
```

---

## 📋 Migration Plan to Monorepo

### Phase 1: Setup Monorepo Structure
```bash
# Create shared package
mkdir -p packages/shared/src/{api,hooks,context,utils,types}

# Setup as npm workspace
# Update root package.json with "workspaces" field
```

### Phase 2: Move Shared Code
```javascript
// Move these to @shared
packages/shared/src/api/index.js          (from both frontend apps)
packages/shared/src/hooks/useAuth.js      (new)
packages/shared/src/context/AuthContext.js (new)
packages/shared/src/utils/storage.js      (from both)
packages/shared/src/utils/validators.js   (new)
```

### Phase 3: Update Imports
```javascript
// Old (web)
import api from './api';
import * as storage from './storage';

// New (both web & mobile)
import * as api from '@shared/api';
import { useAuth } from '@shared/hooks';
import * as storage from '@shared/utils/storage';
```

### Phase 4: Keep Platform-Specific Code
```
Web only: React components, CSS, routing
Mobile only: React Native components, navigation
Both: API calls, hooks, state management
```

---

## 🚀 Running Both Apps

### Development Mode

```bash
# Terminal 1: Backend
cd backend
npm start
# Running on http://localhost:4000

# Terminal 2: Web App
cd frontend-app
npm start
# Running on http://localhost:3000

# Terminal 3: Mobile App (Expo)
cd frontend
npm start
# Running on http://localhost:8081
# Scan QR code with Expo Go app
```

### Build for Production

```bash
# Web
cd frontend-app
npm run build

# Mobile (Expo)
cd frontend
eas build --platform all
```

---

## 📊 Comparison Table

| Feature | Web App | Mobile App |
|---------|---------|------------|
| Framework | React | React Native |
| Language | JavaScript/CSS | JavaScript |
| Styling | CSS/Tailwind | StyleSheet |
| Navigation | React Router | React Navigation |
| Storage | localStorage | AsyncStorage |
| **Shared Code** | **@shared/** | **@shared/** |
| API Calls | ✅ From @shared | ✅ From @shared |
| Auth Logic | ✅ From @shared | ✅ From @shared |
| Data Hooks | ✅ From @shared | ✅ From @shared |

---

## 🛠️ Best Practices

### ✅ DO
- ✅ Put API calls in `@shared/api`
- ✅ Create custom hooks for data logic in `@shared/hooks`
- ✅ Use Context API for global state in `@shared/context`
- ✅ Share validators and utilities in `@shared/utils`
- ✅ Import from `@shared` in both apps
- ✅ Keep UI components platform-specific

### ❌ DON'T
- ❌ Duplicate API calls in both apps
- ❌ Put React components in shared
- ❌ Put CSS/StyleSheet in shared
- ❌ Ignore platform differences
- ❌ Share navigation code
- ❌ Create duplicate hooks/utilities

---

## 📚 Related Documents

- `MONOREPO_STRUCTURE.md` - Existing structure reference
- `SETUP.md` - Initial setup instructions
- `PARALLEL_DEVELOPMENT_ROADMAP.md` - Development timeline
- `backend/README.md` - API documentation
- `frontend-app/README.md` - Web app documentation
- `frontend/README.md` - Mobile app documentation

---

## 🔗 File References

### Current Implementation (Before Monorepo)
- Web API: `/frontend-app/src/api.js`
- Mobile API: `/frontend/src/services/api.js`
- Mobile Storage: `/frontend/src/services/storage.js`

### Future Implementation (After Monorepo)
- Shared API: `/packages/shared/src/api/index.js`
- Shared Hooks: `/packages/shared/src/hooks/`
- Shared Utils: `/packages/shared/src/utils/`

---

## 💡 Example: Adding a New Feature

**Goal:** Add a "Favorite Save" feature to both apps

### Step 1: Update Backend
```javascript
// backend/src/routes/saves.js
PATCH /saves/:id/favorite   // Toggle favorite status
```

### Step 2: Add to Shared Hooks
```javascript
// packages/shared/src/hooks/useSaves.js
export function useSaves() {
  const toggleFavorite = async (saveId) => {
    const result = await api.toggleFavorite(saveId);
    return result;
  };
  
  return { toggleFavorite };
}
```

### Step 3: Use in Web App
```javascript
// frontend-app/src/screens/SaveDetail.jsx
import { useSaves } from '@shared/hooks';

export default function SaveDetail() {
  const { toggleFavorite } = useSaves();
  
  return (
    <button onClick={() => toggleFavorite(saveId)}>
      ❤️ Favorite
    </button>
  );
}
```

### Step 4: Use in Mobile App (SAME CODE!)
```javascript
// frontend/src/screens/SaveDetailScreen.js
import { useSaves } from '@shared/hooks';

export default function SaveDetailScreen() {
  const { toggleFavorite } = useSaves();
  
  return (
    <Pressable onPress={() => toggleFavorite(saveId)}>
      <Text>❤️ Favorite</Text>
    </Pressable>
  );
}
```

**Result:** Same feature, same logic, different UI! 🎉

---

---

## 🌱 Seed Data for Testing

### Overview
Seed data provides realistic test URLs for the extraction pipeline. This allows testing the full "URL → Save" workflow without manual data entry.

### Location
```
trythis-seed-data/
├── seed-data/
│   ├── seeds.json              (Input: 50+ test URLs)
│   ├── ingest-seeds.js         (Processing script)
│   ├── processed-saves.json    (Output: structured saves)
│   └── README.md
```

### Seed Data Structure

**seeds.json** - Input file with test URLs:
```json
{
  "_meta": {
    "version": "1.0",
    "totalSeeds": 50,
    "categoryDistribution": {
      "cafes": 5,
      "food": 5,
      "travel": 10,
      "shopping": 10,
      "experiences": 5,
      "fashion": 5,
      "tech": 5,
      "books": 5
    }
  },
  "seeds": [
    {
      "id": "seed_cafe_01",
      "sourceUrl": "https://www.instagram.com/cafesofbangalore/",
      "sourceType": "instagram_profile",
      "creator": "@cafesofbangalore",
      "expectedExtraction": {
        "title": "Cafes of Bangalore",
        "description": "Curated cafe guide for Bengaluru",
        "category": "Food",
        "tags": ["cafe", "bengaluru", "discovery"]
      }
    },
    // ... more seeds
  ]
}
```

### Processing Pipeline

**ingest-seeds.js** - Processes URLs through extraction pipeline:

```
seeds.json (URLs)
    ↓
1. Fetch URL content
    ↓
2. Extract OG metadata
    ↓
3. Parse captions/descriptions
    ↓
4. Detect source type
    ↓
5. Entity extraction (location, price, etc)
    ↓
6. Category classification
    ↓
processed-saves.json (Structured saves)
```

### Running Seed Data Ingestion

```bash
cd trythis-seed-data/seed-data

# Install dependencies
npm install axios cheerio open-graph-scraper p-limit

# Run ingestion
node ingest-seeds.js

# Output: processed-saves.json with structured data ready for MongoDB
```

### Seed Data Categories

- 🏘️ **Travel** (10) - Hotels, destinations, itineraries
- 🍽️ **Food** (5) - Recipes, restaurants, food blogs
- ☕ **Cafes** (5) - Cafe recommendations, cafe culture
- 🛍️ **Shopping** (10) - E-commerce, fashion, deals
- 🎭 **Experiences** (5) - Activities, events, workshops
- 👗 **Fashion** (5) - Clothing, style guides, lookbooks
- 💻 **Tech** (5) - Gadgets, software, tutorials
- 📚 **Books** (5) - Reading lists, book reviews

### Sources Included

- **Instagram** - Profile pages, reel URLs
- **Pinterest** - Pins and boards
- **YouTube** - Video pages
- **Zomato** - Restaurant/cafe guides
- **E-commerce** - Amazon, Flipkart, Myntra, AJIO, Nykaa
- **Generic Web** - Articles, blogs, guides

### Using Processed Seeds in Backend

Once processed, seeds can be imported into MongoDB:

```javascript
// backend/scripts/import-seeds.js
const processedSaves = require('../seeds/processed-saves.json');

async function importSeeds() {
  for (const save of processedSaves) {
    await Save.create({
      title: save.title,
      description: save.description,
      url: save.url,
      category: save.category,
      image: save.image,
      source: save.source,
      userId: testUserId // Use test user
    });
  }
}
```

### Testing the Extraction Pipeline

Use processed seeds to test:
1. ✅ URL parsing
2. ✅ OG metadata extraction
3. ✅ Image fetching
4. ✅ Category classification
5. ✅ Entity detection (location, price, etc)
6. ✅ Storage in MongoDB

### Seed Data Notes

- All URLs are **public content** (Instagram public profiles, Pinterest pins, etc)
- Instagram/Pinterest content may get deleted - validate before demos
- **50 seeds** cover diverse categories for comprehensive testing
- Process is **parallel** (4 concurrent requests) for speed
- Output includes **metadata** for validation and debugging

---

## 🎯 Summary

This architecture allows TryThis to:
1. ✅ Have both web and mobile versions
2. ✅ Share business logic (API, hooks, state)
3. ✅ Keep platform-specific code separate
4. ✅ Avoid code duplication
5. ✅ Make changes once, benefit everywhere
6. ✅ Maintain consistency across platforms
7. ✅ Scale efficiently
8. ✅ Test with realistic seed data

Future monorepo setup will make this even better! 🚀
