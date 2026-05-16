# Phase 1 Testing Guide

Test auth endpoints with curl before testing the UI.

---

## Backend Testing (Curl)

### 1. Test Health Endpoint
```bash
curl http://localhost:4000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "TryThis API is running"
}
```

---

### 2. Test Signup Endpoint

```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123",
    "name": "Test User"
  }'
```

**Expected Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "65a1234567890abcdef12345",
      "email": "testuser@example.com",
      "name": "Test User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Backend logs:**
```
✅ User signed up: testuser@example.com
```

---

### 3. Test Login Endpoint

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }'
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "65a1234567890abcdef12345",
      "email": "testuser@example.com",
      "name": "Test User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Backend logs:**
```
✅ User logged in: testuser@example.com
```

---

### 4. Test Login with Wrong Password

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "WrongPassword"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

### 5. Test Duplicate Signup

```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123",
    "name": "Another User"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "error": {
    "code": "USER_EXISTS",
    "message": "Email already registered"
  }
}
```

---

## Frontend Testing (App)

### Flow 1: Signup → Home

**Step 1:** Open app in Expo Go
- Should show Splash screen
- Auto-redirects to Signup (no token yet)

**Step 2:** Signup form
- Enter Name: "Test User"
- Enter Email: "app@example.com"
- Enter Password: "TestPassword123"
- Tap "Sign Up"

**Expected:**
- Loading spinner appears
- Success message
- Auto-navigates to Home (Tabs)
- Home screen shows "Your Saves"

**Check storage (backend):**
```bash
curl http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@example.com",
    "password": "TestPassword123"
  }'
```

---

### Flow 2: Kill App → Auto-Login

**Step 1:** Close Expo app completely
**Step 2:** Reopen app

**Expected:**
- Shows Splash briefly
- Auto-navigates to Home (Tabs)
- Token was persisted!

**Verification:** Token is stored in AsyncStorage, app retrieved it and skipped auth.

---

### Flow 3: Add Logout (Future)

Add this to ProfileScreen to test logout:

```javascript
import * as storage from '../services/storage';

<Pressable onPress={() => {
  storage.logout();
  navigation.replace('SignupLogin');
}}>
  <Text>Logout</Text>
</Pressable>
```

Then test:
1. Tap Logout
2. Back to Login screen
3. Close and reopen → Back to Login (no token)

---

## Error Cases to Test

### Case 1: Missing Email
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPassword123",
    "name": "Test User"
  }'
```

**Expected:** 400 Validation Error

---

### Case 2: Invalid Email Format
**In app:** Type "notanemail" in email field
- Should show error "Valid email required"
- Button disabled

---

### Case 3: Password Too Short
**In app:** Type "short" in password field
- Should show error "Password must be at least 8 characters"
- Button disabled

---

### Case 4: Network Error
**Stop backend:** `Ctrl+C` in backend terminal

**In app:** Try to signup
- Should show "Something went wrong. Please try again."
- Can still try again after backend restarts

---

## Database Verification

Check users were created in MongoDB:

```bash
# Open MongoDB shell
docker-compose exec mongodb mongosh

# In MongoDB shell:
use trythis
db.users.find()

# Example output:
{
  "_id": ObjectId("..."),
  "email": "testuser@example.com",
  "password": "$2b$10$...", // bcrypt hashed
  "name": "Test User",
  "metadata": {
    "lastLogin": ISODate("2024-01-15T10:30:00.000Z"),
    "loginCount": 2
  }
}
```

**Verify:**
- ✅ Email is lowercase
- ✅ Password is hashed (starts with $2b$)
- ✅ loginCount increased after login

---

## Performance Check

### Signup time
- Should complete in < 2 seconds
- Most time is password hashing (intentional for security)

### Login time
- Should complete in < 1 second

### Token validation
- Token should be valid for 30 days
- Check: `jwt.io` - paste token to decode

---

## Troubleshooting Checklist

- [ ] Backend running on http://localhost:4000
- [ ] MongoDB running (docker-compose up)
- [ ] Redis running (docker-compose up)
- [ ] Frontend REACT_APP_API_URL = http://localhost:4000
- [ ] No console errors in either app
- [ ] Password hashing taking 1-2 seconds (normal)
- [ ] Tokens are being saved to AsyncStorage
- [ ] User data is in MongoDB

---

## Test Checklist

### Backend API ✅
- [ ] GET /health returns ok
- [ ] POST /auth/signup creates user
- [ ] POST /auth/login authenticates user
- [ ] Password hashing works (can't see plain password)
- [ ] Duplicate email rejected
- [ ] Invalid password rejected
- [ ] Users in MongoDB are lowercase email
- [ ] loginCount incremented on each login

### Frontend UI ✅
- [ ] Splash screen auto-detects auth
- [ ] Signup form validates inputs
- [ ] Login form validates inputs
- [ ] Loading spinner shows during auth
- [ ] Error messages display
- [ ] After signup → Home screen
- [ ] After login → Home screen
- [ ] Close app → Reopens to Home (token persisted)
- [ ] All navigation works

### Integration ✅
- [ ] Signup uses correct API endpoint
- [ ] Login uses correct API endpoint
- [ ] Token is stored after signup/login
- [ ] Token is sent in all requests
- [ ] Token is retrieved on app start
- [ ] Logout clears token

---

## Success Criteria Met? 🎯

When ALL boxes are checked above, Phase 1 is complete:

```
✅ Backend signup/login working
✅ Frontend signup/login screens built
✅ Authentication flow end-to-end
✅ Token persistence working
✅ Password hashing secure
✅ All errors handled
✅ Ready for Phase 2
```

---

## Next Phase: Save Creation

Once Phase 1 is solid:

1. Test POST /saves endpoint (already exists in backend)
2. Build save creation UI in QuickSaveScreen
3. Connect to API
4. Test: Create save in app → verify in database

---

**Time to complete Phase 1 testing:** 20-30 minutes

Happy testing! 🧪
