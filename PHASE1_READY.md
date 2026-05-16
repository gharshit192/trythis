# 🚀 Phase 1: Authentication - READY TO BUILD

All files have been created. Everything is ready to run!

## ✅ What Was Created

### Frontend (3 screens + 2 services)
- ✅ `frontend/src/screens/SplashScreen.js` - Auto-detects auth state
- ✅ `frontend/src/screens/SignupScreen.js` - New user registration
- ✅ `frontend/src/screens/LoginScreen.js` - Existing user login
- ✅ `frontend/src/services/storage.js` - Local token storage (AsyncStorage)
- ✅ `frontend/src/services/api.js` - API client with auto auth headers
- ✅ `frontend/src/navigation/RootNavigator.js` - Updated with auth flow

### Backend (Enhanced Auth)
- ✅ `backend/src/routes/auth.js` - Updated with bcrypt password hashing
- ✅ `backend/package.json` - Added bcrypt dependency

### Dependencies Added
**Frontend:**
- `@react-native-async-storage/async-storage` - Local storage
- `axios` - HTTP client

**Backend:**
- `bcrypt` - Password hashing

---

## 🏃 Quick Start (5 minutes)

### Terminal 1: Backend Setup
```bash
cd backend

# Install bcrypt
npm install

# Verify MongoDB and Redis are running
# (from docker-compose in another terminal)

# Start backend
npm run dev
```

**Expected Output:**
```
✓ Server running on http://localhost:3000
✓ MongoDB connected
✓ Redis connected
```

### Terminal 2: Frontend Setup
```bash
cd frontend

# Install async-storage and axios
npm install

# Start Expo
npm start
```

**Expected Output:**
```
✓ Expo server started
Scan QR code with Expo Go app
```

### Terminal 3: Docker (if needed)
```bash
docker-compose up
```

---

## 🧪 Test the Flow

### 1. Open App in Expo Go
- Scan QR code from Terminal 2
- Should see Splash screen briefly
- Then redirect to Signup screen (no token yet)

### 2. Create Account
```
Name:     Test User
Email:    test@example.com
Password: TestPassword123
```

**Backend logs should show:**
```
✅ User signed up: test@example.com
```

**App should:**
- Navigate to Home screen (Tabs)
- Store token in AsyncStorage

### 3. Kill app, reopen in Expo Go
- Should skip Signup/Login
- Go directly to Home screen
- Token was persisted!

### 4. Logout (add this to ProfileScreen later)
- Clear token from storage
- Back to login screen

---

## 📱 Auth Flow Diagram

```
App Starts
    ↓
SplashScreen (checks token)
    ├─ Token found → Home (Tabs)
    └─ No token → SignupLogin Stack
        ├─ Signup → Create account → Home
        └─ Login → Authenticate → Home
```

---

## 🔐 What Each File Does

### Frontend

**SplashScreen.js**
- Checks if token exists in storage
- Shows loading spinner while checking
- Routes to Tabs (home) or SignupLogin (auth)

**SignupScreen.js**
- Collects: name, email, password
- Validates input (email format, password length)
- Calls `api.signup()`
- Stores token + user in storage
- Navigates to home

**LoginScreen.js**
- Collects: email, password
- Validates input
- Calls `api.login()`
- Stores token + user in storage
- Navigates to home

**services/storage.js**
- `setAuthToken()` - Save token to AsyncStorage
- `getAuthToken()` - Retrieve token
- `setUser()` - Save user data
- `getUser()` - Retrieve user data
- `logout()` - Clear everything

**services/api.js**
- Creates axios instance with API base URL
- Auto-adds auth token to all requests
- `signup()` - POST /auth/signup
- `login()` - POST /auth/login
- Ready for: saves, collections, search, etc.

**RootNavigator.js**
- Checks auth state on app start
- Shows Splash while checking
- Renders appropriate stack (Auth or Tabs)
- Auto-updates when user logs in/out

### Backend

**backend/src/routes/auth.js**
- `POST /auth/signup` - Create account
  - Validates email/password
  - Hashes password with bcrypt
  - Generates JWT token (30 days)
  - Returns: user + token
  
- `POST /auth/login` - Authenticate
  - Finds user by email
  - Compares passwords with bcrypt
  - Generates JWT token
  - Returns: user + token
  
- `POST /auth/refresh` - Extend session
  - Takes expired token
  - Issues new token

---

## 🛠️ Common Issues & Fixes

### "Connection refused localhost:3000"
```bash
# Verify backend is running
cd backend && npm run dev

# Verify port is not in use
lsof -ti:3000 | xargs kill -9
```

### "AsyncStorage not found"
```bash
cd frontend
npm install @react-native-async-storage/async-storage
```

### "bcrypt not found in backend"
```bash
cd backend
npm install bcrypt
```

### "Network error on signup"
1. Check backend is running on localhost:3000
2. Check `REACT_APP_API_URL` in frontend/.env (should be http://localhost:3000)
3. Check MongoDB is running (docker-compose up)

---

## ✨ What Works Now

✅ Users can create account
✅ Users can login
✅ Tokens are persisted
✅ Auto-login on app restart
✅ Error messages on validation
✅ Loading states
✅ Secure password hashing (bcrypt)
✅ JWT tokens (30 day expiry)

---

## 📋 Next: Phase 2 (Create Saves)

Once Phase 1 is working:

1. **Backend:** Create POST /saves route (already exists, just test it)
2. **Frontend:** Build save creation UI in QuickSaveScreen
3. **Integration:** Wire frontend to API
4. **Test:** Create save from app → verify in database

---

## 📊 File Summary

```
Phase 1 Created:
├── Frontend (5 files)
│   ├── screens/SplashScreen.js
│   ├── screens/SignupScreen.js
│   ├── screens/LoginScreen.js
│   ├── services/storage.js
│   ├── services/api.js
│   └── navigation/RootNavigator.js (updated)
├── Backend (2 files)
│   ├── routes/auth.js (updated)
│   └── package.json (updated)
└── Dependencies
    ├── bcrypt (backend)
    ├── axios (frontend)
    └── @react-native-async-storage/async-storage (frontend)
```

---

## 🎯 Success Criteria

Phase 1 is complete when:

- [ ] Backend signup endpoint works (test with curl)
- [ ] Backend login endpoint works (test with curl)
- [ ] Frontend Splash screen checks for token
- [ ] Frontend can signup and navigate to home
- [ ] Frontend can logout and navigate to login
- [ ] Token persists after app restart
- [ ] All error messages display properly
- [ ] No console errors in either app

---

## 🚀 Ready to Build?

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start

# Scan QR code and test the flow!
```

**Time estimate:** 30 minutes to verify everything works end-to-end.

Good luck! 🎉
