# Parallel Development Roadmap

Build UI and Backend simultaneously following end-to-end flows.

## Core User Journeys

```
1. ONBOARDING FLOW
   Splash Screen → Signup/Login → Home Screen

2. SAVE FLOW
   Home → Quick Save → Save Created → Collection Assignment

3. EXPLORE FLOW
   Home → Search → Filter Results → View Save Detail

4. COLLECTIONS FLOW
   Collections Tab → Create Collection → Add Saves

5. RECOMMENDATIONS FLOW
   Home → View Save → See Recommendations → Save Recommended Item

6. SMART RESURFACING FLOW
   Trigger Detected → Push Notification → User Opens → Save Resurfaces
```

---

## Phase 1: Authentication (Days 1-3)

### Sprint Goal
User can sign up, login, and reach home screen with persistent auth token.

### Backend Tasks

**File:** `backend/src/routes/auth.js` (Already created, needs fixes)

```javascript
// FIX: Password hashing
const bcrypt = require('bcrypt');

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'USER_EXISTS', message: 'Email already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || email.split('@')[0],
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    logger.info(`User signed up: ${email}`);
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    });
  } catch (error) {
    logger.error(`Signup error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Signup failed' },
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last login
    user.metadata.lastLogin = new Date();
    user.metadata.loginCount = (user.metadata.loginCount || 0) + 1;
    await user.save();

    logger.info(`User logged in: ${email}`);
    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SERVER_ERROR', message: 'Login failed' },
    });
  }
});
```

**Install bcrypt:**
```bash
cd backend
npm install bcrypt
```

**Test Auth Endpoints:**
```bash
# Signup
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!","name":"Test User"}'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

### Frontend Tasks

**File:** `frontend/src/screens/SplashScreen.js`

```javascript
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { colors, spacing } from '../theme';
import { getAuthToken, getUser } from '../services/storage';

const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getAuthToken();
        const user = await getUser();

        // Simulate splash duration
        setTimeout(() => {
          if (token && user) {
            navigation.replace('HomeTabs');
          } else {
            navigation.replace('Auth');
          }
        }, 1500);
      } catch (error) {
        navigation.replace('Auth');
      }
    };

    checkAuth();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>TryThis</Text>
        <Text style={styles.tagline}>Save Now. Try Later.</Text>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  tagline: {
    fontSize: 18,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});

export default SplashScreen;
```

**File:** `frontend/src/screens/SignupScreen.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import TextField from '../components/TextField';
import Button from '../components/Button';
import * as api from '../services/api';
import * as storage from '../services/storage';

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.includes('@')) {
      newErrors.email = 'Valid email required';
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await api.signup({
        email: email.toLowerCase(),
        password,
        name,
      });

      if (response.status === 'success') {
        // Save token and user
        await storage.setAuthToken(response.data.token);
        await storage.setUser(response.data.user);

        logger.info(`Signup successful: ${email}`);
        navigation.replace('HomeTabs');
      }
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to start saving things you want to try
          </Text>
        </View>

        <TextField
          label="Full Name"
          placeholder="John Doe"
          value={name}
          onChangeText={setName}
          editable={!loading}
          error={errors.name}
        />

        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
          style={{ marginTop: spacing.lg }}
        />

        <TextField
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          error={errors.password}
          style={{ marginTop: spacing.lg }}
        />

        <Button
          label={loading ? 'Creating Account...' : 'Sign Up'}
          onPress={handleSignup}
          disabled={loading}
          style={{ marginTop: spacing.xl }}
          icon={loading ? <ActivityIndicator color={colors.surface} /> : null}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.link}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.text.secondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default SignupScreen;
```

**File:** `frontend/src/screens/LoginScreen.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { colors, spacing } from '../theme';
import TextField from '../components/TextField';
import Button from '../components/Button';
import * as api from '../services/api';
import * as storage from '../services/storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!email.includes('@')) {
      newErrors.email = 'Valid email required';
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await api.login({
        email: email.toLowerCase(),
        password,
      });

      if (response.status === 'success') {
        // Save token and user
        await storage.setAuthToken(response.data.token);
        await storage.setUser(response.data.user);

        logger.info(`Login successful: ${email}`);
        navigation.replace('HomeTabs');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>TryThis</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to your account</Text>
        </View>

        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />

        <TextField
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          error={errors.password}
          style={{ marginTop: spacing.lg }}
        />

        <Button
          label={loading ? 'Logging In...' : 'Login'}
          onPress={handleLogin}
          disabled={loading}
          style={{ marginTop: spacing.xl }}
          icon={loading ? <ActivityIndicator color={colors.surface} /> : null}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            disabled={loading}
          >
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.text.secondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
```

**File:** `frontend/src/services/storage.js`

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  PREFERENCES: 'preferences',
};

export const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const clearAuthToken = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Error clearing token:', error);
  }
};

export const setUser = async (user) => {
  try {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user:', error);
  }
};

export const getUser = async () => {
  try {
    const user = await AsyncStorage.getItem(KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const clearUser = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.USER);
  } catch (error) {
    console.error('Error clearing user:', error);
  }
};

export const logout = async () => {
  try {
    await Promise.all([clearAuthToken(), clearUser()]);
  } catch (error) {
    console.error('Error logging out:', error);
  }
};
```

**File:** `frontend/src/services/api.js`

```javascript
import axios from 'axios';
import * as storage from './storage';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

// Add auth interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      storage.logout();
    }
    throw error.response?.data || error;
  }
);

// Auth APIs
export const signup = (data) => api.post('/auth/signup', data);
export const login = (data) => api.post('/auth/login', data);
export const refresh = () => api.post('/auth/refresh');

// Save APIs
export const createSave = (data) => api.post('/saves', data);
export const getSaves = () => api.get('/saves');
export const getSaveDetail = (id) => api.get(`/saves/${id}`);
export const updateSave = (id, data) => api.patch(`/saves/${id}`, data);
export const deleteSave = (id) => api.delete(`/saves/${id}`);

// Collection APIs
export const getCollections = () => api.get('/collections');
export const createCollection = (data) => api.post('/collections', data);
export const addSaveToCollection = (collectionId, saveId) =>
  api.post(`/collections/${collectionId}/saves/${saveId}`);

// Search API
export const search = (query) => api.get('/search', { params: query });

// Recommendations API
export const getRecommendations = (saveId) =>
  api.get(`/recommendations/${saveId}`);

// Notifications API
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}`, { read: true });
```

**Update Navigation:** `frontend/src/navigation/RootNavigator.js`

```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import SplashScreen from '../screens/SplashScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import SaveDetailScreen from '../screens/SaveDetailScreen';
import CollectionsScreen from '../screens/CollectionsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

const HomeTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#6C63FF',
      tabBarInactiveTintColor: '#D1D5DB',
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarLabel: 'Home',
        tabBarTestID: 'tab-home',
      }}
    />
    <Tab.Screen
      name="Search"
      component={SearchScreen}
      options={{ tabBarLabel: 'Search' }}
    />
    <Tab.Screen
      name="Save"
      component={QuickSaveScreen}
      options={{
        tabBarLabel: 'Save',
        tabBarStyle: { height: 0 },
      }}
    />
    <Tab.Screen
      name="Collections"
      component={CollectionsScreen}
      options={{ tabBarLabel: 'Collections' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Profile' }}
    />
  </Tab.Navigator>
);

const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Group>
          <Stack.Screen name="Auth" component={AuthNavigator} />
          <Stack.Screen name="HomeTabs" component={HomeTabs} />
        </Stack.Group>

        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="SaveDetail" component={SaveDetailScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
```

**Install Dependencies:**
```bash
cd frontend
npm install @react-native-async-storage/async-storage @react-navigation/bottom-tabs
```

---

## Phase 2: Save Creation & Retrieval (Days 4-6)

### Sprint Goal
User can create a save and see it on home screen.

### Backend: Verify `/POST /saves`

Already created in `backend/src/routes/saves.js`

**Test:**
```bash
# With auth token
curl -X POST http://localhost:4000/saves \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title":"Paris Hotel",
    "url":"https://example.com/hotel",
    "notes":"5-star luxury"
  }'
```

### Frontend: Build Save Creation Flow

**File:** `frontend/src/screens/QuickSaveScreen.js` - Already created above

**File:** `frontend/src/screens/HomeScreen.js`

```javascript
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Text,
} from 'react-native';
import { colors, spacing } from '../theme';
import * as api from '../services/api';
import SaveCard from '../components/SaveCard';
import EmptyState from '../components/EmptyState';

const HomeScreen = ({ navigation }) => {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSaves();

    // Listen for save creation events
    const unsubscribe = navigation.addListener('focus', () => {
      loadSaves();
    });

    return unsubscribe;
  }, [navigation]);

  const loadSaves = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getSaves();
      setSaves(response.data || []);
    } catch (err) {
      setError('Failed to load saves');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSaves();
  };

  const handleSavePress = (save) => {
    navigation.navigate('SaveDetail', { saveId: save._id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert"
          title="Error Loading Saves"
          description={error}
          action={{ label: 'Retry', onPress: loadSaves }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Saves</Text>
      </View>

      {saves.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No saves yet"
          description="Start saving things you want to try later"
          action={{ label: 'Add First Save', onPress: () => navigation.navigate('Save') }}
        />
      ) : (
        <FlatList
          data={saves}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <SaveCard
              save={item}
              onPress={() => handleSavePress(item)}
              showPrice
              showLocation
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});

export default HomeScreen;
```

---

## Phase 3: Collections & Organization (Days 7-9)

*Same pattern: Backend route → Frontend screen → Integration*

---

## Phase 4: Search & Discovery (Days 10-12)

*Same pattern: Backend search endpoint → Frontend SearchScreen*

---

## Phase 5: Recommendations & Smart Resurfacing (Days 13-15)

*Same pattern: Backend engine → Frontend UI → Notifications*

---

## Daily Development Rhythm

### Each Phase (3-day sprint)

**Day 1: Backend**
- Implement/fix routes
- Test with curl/Postman
- Verify database operations

**Day 2: Frontend**
- Build screens/components
- Hook to mock data first
- Test UI rendering

**Day 3: Integration**
- Connect frontend to backend
- Test end-to-end
- Handle errors
- Deploy to staging

---

## What to Build Next

### ✅ Phase 1 (TODAY)

**Backend:**
1. Fix auth routes (add bcrypt)
2. Test signup & login
3. Verify token generation

**Frontend:**
1. Create SplashScreen
2. Create SignupScreen
3. Create LoginScreen
4. Create storage.js
5. Create api.js
6. Update navigation

**Test:**
```bash
# Sign up in app
# Login in app
# Verify token saved
# Verify redirect to Home
```

---

## File Checklist - Phase 1

### Backend
- [ ] `backend/src/routes/auth.js` - Fix password hashing
- [ ] `backend/package.json` - Add bcrypt

### Frontend
- [ ] `frontend/src/screens/SplashScreen.js` - New
- [ ] `frontend/src/screens/SignupScreen.js` - New
- [ ] `frontend/src/screens/LoginScreen.js` - New
- [ ] `frontend/src/services/storage.js` - New
- [ ] `frontend/src/services/api.js` - New
- [ ] `frontend/src/navigation/RootNavigator.js` - Update
- [ ] `frontend/package.json` - Add async-storage, bottom-tabs

---

## Running Both Simultaneously

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm start

# Terminal 3: Watch tests (optional)
cd frontend
npm test -- --watch
```

---

## Git Workflow

For each phase:
```bash
git checkout -b feature/phase1-auth
# Make changes to backend + frontend
git add .
git commit -m "feat(auth): implement signup/login flow"
git push origin feature/phase1-auth
# Create PR
```

---

Let me know when ready to start Phase 1!
