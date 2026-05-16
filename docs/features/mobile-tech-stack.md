# Mobile App Tech Stack - TryThis

**Platform:** iOS + Android (Single Codebase)

**Decision:** React Native with Expo (MVP)

---

## Why React Native?

| Criterion | React Native | Native (Swift/Kotlin) | Flutter |
|-----------|--------------|----------------------|---------|
| Time to Market | ✅ Fast (1 codebase) | ❌ Slow (2 codebases) | ✅ Fast |
| Code Reuse | ✅ Share 90%+ | ❌ 0% | ✅ Share 100% |
| Performance | ✅ Good (95%+ native) | ✅ Best | ⚠️ Good |
| Developer Experience | ✅ Hot reload | ✅ Excellent | ✅ Excellent |
| Team Familiarity | ✅ JavaScript/React | ❌ Need Swift/Kotlin experts | ❌ Need Dart experts |
| Cost | ✅ 1 team | ❌ 2 teams | ✅ 1 team |
| **Recommendation** | **✅ BEST** | ❌ | ⚠️ |

---

## React Native Setup

### Development Environment

```bash
# Installation (Expo is recommended for MVP)
npm install -g expo-cli
npx create-expo-app TryThis

# Navigate to project
cd TryThis

# Start development server
expo start

# Run on iOS simulator or Android emulator
# (Scan QR code with Expo Go app on physical phone)
```

### Expo vs. React Native CLI

| Feature | Expo | React Native CLI |
|---------|------|-------------------|
| Setup Speed | ✅ Minutes | ⏱️ Hours |
| Native Modules | Limited | ✅ Unlimited |
| Over-the-air Updates | ✅ Built-in | ❌ Manual |
| Ejecting | ⚠️ Possible | N/A |
| **MVP Choice** | **✅ YES** | Later (Phase 2) |

**Recommendation:** Start with Expo (fast iteration), migrate to React Native CLI in Phase 2 if needed for custom native modules.

---

## Core Stack

### 1. Framework: React Native + Expo

```javascript
// App.js
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

### 2. Navigation: React Navigation

**What to use:**
```javascript
// Install
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

// Bottom tab navigation
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

function BottomTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ tabBarIcon: () => <HomeIcon /> }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{ tabBarIcon: () => <SearchIcon /> }}
      />
      <Tab.Screen 
        name="Collections" 
        component={CollectionsScreen}
        options={{ tabBarIcon: () => <FolderIcon /> }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarIcon: () => <UserIcon /> }}
      />
    </Tab.Navigator>
  );
}
```

**Navigation Structure:**
```
App
├── AuthStack
│   ├── LoginScreen
│   ├── SignUpScreen
│   └── OnboardingScreen
│
└── MainStack
    ├── BottomTabs
    │   ├── HomeScreen (Saves feed)
    │   ├── SearchScreen (Find saves)
    │   ├── CollectionsScreen (Organized saves)
    │   └── ProfileScreen (User profile)
    │
    └── ModalStack (Modals above tabs)
        ├── SaveDetailScreen
        ├── CreateCollectionScreen
        └── SettingsScreen
```

---

### 3. State Management: Zustand (MVP) → Redux (Phase 2)

#### MVP: Zustand
Simple, lightweight, zero boilerplate

```javascript
// store/saveStore.js
import create from 'zustand';

export const useSaveStore = create((set, get) => ({
  saves: [],
  collections: [],
  selectedCollection: null,
  
  // Actions
  addSave: (save) => set((state) => ({
    saves: [...state.saves, save]
  })),
  
  removeSave: (saveId) => set((state) => ({
    saves: state.saves.filter(s => s.id !== saveId)
  })),
  
  setCollections: (collections) => set({ collections }),
  
  setSelectedCollection: (collectionId) => set({ selectedCollection: collectionId })
}));

// Usage in component
function SaveList() {
  const { saves } = useSaveStore();
  
  return (
    <FlatList
      data={saves}
      renderItem={({ item }) => <SaveCard save={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

#### Phase 2: Redux Toolkit (if needed)
When state complexity grows beyond 3-5 stores

```javascript
// store/slices/savesSlice.js
import { createSlice } from '@reduxjs/toolkit';

const savesSlice = createSlice({
  name: 'saves',
  initialState: { items: [], loading: false },
  reducers: {
    setSaves: (state, action) => {
      state.items = action.payload;
    },
    addSave: (state, action) => {
      state.items.push(action.payload);
    }
  }
});

export default savesSlice.reducer;
```

---

### 4. API Communication: Axios + React Query

```javascript
// api/client.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const client = axios.create({
  baseURL: 'https://api.trythis.app/v1',
  timeout: 10000
});

// Add auth token to requests
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired - logout user
      logoutUser();
    }
    return Promise.reject(error);
  }
);

export default client;
```

**React Query for Data Fetching:**
```javascript
// hooks/useSaves.js
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

export function useSaves() {
  return useQuery({
    queryKey: ['saves'],
    queryFn: async () => {
      const { data } = await client.get('/saves');
      return data.data.saves;
    },
    staleTime: 5 * 60 * 1000  // 5 minutes
  });
}

// Usage
function SavesScreen() {
  const { data: saves, isLoading, error } = useSaves();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <FlatList
      data={saves}
      renderItem={({ item }) => <SaveCard save={item} />}
    />
  );
}
```

---

### 5. UI Component Library: React Native Paper

**Why React Native Paper:**
- ✅ Material Design 3 components
- ✅ Dark mode support
- ✅ 50+ ready-made components
- ✅ Theming system

```javascript
// Installation
npm install react-native-paper

// Theme setup
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';

const theme = {
  ...MD3LightTheme,
  colors: {
    primary: '#007AFF',
    accent: '#FF6B6B',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    error: '#FF3B30'
  }
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <MainApp />
    </PaperProvider>
  );
}
```

**Common Components:**
```javascript
import { Button, Card, TextInput, FAB, Snackbar } from 'react-native-paper';

// Save Card
<Card>
  <Card.Cover source={{ uri: save.image }} />
  <Card.Content>
    <Text variant="titleLarge">{save.title}</Text>
    <Text variant="bodyMedium">{save.description}</Text>
  </Card.Content>
  <Card.Actions>
    <Button>Open</Button>
    <Button>Save</Button>
  </Card.Actions>
</Card>

// Share bottom sheet
<TextInput
  label="Notes"
  placeholder="Add notes to your save"
  multiline
  numberOfLines={3}
/>

// FAB for quick save
<FAB
  icon="plus"
  label="Add Save"
  onPress={() => openShareSheet()}
  style={{ position: 'absolute', right: 16, bottom: 16 }}
/>
```

---

### 6. Camera & Photo Library: React Native Vision Camera

**For capturing/selecting images:**

```javascript
npm install react-native-vision-camera react-native-reanimated

// Camera component
import { Camera, useCameraDevice } from 'react-native-vision-camera';

export function CameraScreen({ navigation }) {
  const device = useCameraDevice('back');
  const camera = useRef(null);

  const takePhoto = async () => {
    const photo = await camera.current?.takePhoto({
      qualityPrioritization: 'speed',
      skipMetadata: false
    });
    
    // Send photo to backend for OCR
    await uploadScreenshot(photo);
    navigation.goBack();
  };

  if (!device) return <Text>No camera device found</Text>;

  return (
    <Camera
      ref={camera}
      device={device}
      isActive={true}
      photo={true}
      style={StyleSheet.absoluteFill}
    />
  );
}
```

---

### 7. Secure Storage: Expo SecureStore

**For storing auth tokens:**

```javascript
import * as SecureStore from 'expo-secure-store';

// Save token after login
async function handleLogin(credentials) {
  const { token } = await loginAPI(credentials);
  await SecureStore.setItemAsync('auth_token', token);
}

// Retrieve token on app start
async function getAuthToken() {
  return await SecureStore.getItemAsync('auth_token');
}

// Clear token on logout
async function handleLogout() {
  await SecureStore.deleteItemAsync('auth_token');
}
```

---

### 8. Local Database: SQLite (Phase 2)

**For offline caching:**

```javascript
npm install expo-sqlite

import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('trythis.db');

// Cache saves locally
async function cacheSaves(saves) {
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, data TEXT);'
      );
      
      saves.forEach(save => {
        tx.executeSql(
          'INSERT OR REPLACE INTO saves VALUES (?, ?)',
          [save.id, JSON.stringify(save)]
        );
      });
    }, null, resolve);
  });
}

// Read from cache
async function getCachedSaves() {
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM saves ORDER BY id DESC LIMIT 100',
        [],
        (_, { rows }) => resolve(rows._array.map(r => JSON.parse(r.data)))
      );
    });
  });
}
```

---

### 9. Share Sheet Integration: React Native Share

**For sharing saves to Instagram, WhatsApp, etc:**

```javascript
npm install react-native-share

import Share from 'react-native-share';

async function shareToInstagram(save) {
  try {
    await Share.open({
      message: `Check out this place: ${save.title}`,
      url: `file://${save.image}`,  // Local image path
      social: Share.Social.INSTAGRAM,
      failOnCancel: false
    });
  } catch (error) {
    console.error('Share failed:', error);
  }
}
```

---

### 10. Push Notifications: Expo Notifications

**For alerts about recommendations, price drops:**

```javascript
import * as Notifications from 'expo-notifications';

// Request permission
async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  
  if (status !== 'granted') {
    alert('You need to enable notifications!');
    return;
  }
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  // Send token to backend
  await updatePushToken(token);
}

// Handle notification when app is open
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('Notification received:', notification);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    };
  }
});

// Listen for taps
Notifications.addNotificationResponseReceivedListener(response => {
  const { saveId } = response.notification.request.content.data;
  navigation.navigate('SaveDetail', { saveId });
});
```

---

## Complete Mobile Architecture

```
TryThis App
│
├── App.tsx (Root)
│   ├── AuthContext (Global auth state)
│   └── Navigation
│       ├── AuthStack
│       └── MainStack
│
├── Screens/
│   ├── Auth/
│   │   ├── LoginScreen
│   │   └── SignUpScreen
│   │
│   ├── Main/
│   │   ├── HomeScreen (Feed of saves)
│   │   ├── SearchScreen (Find saves)
│   │   ├── CollectionsScreen (Organized)
│   │   └── ProfileScreen (User settings)
│   │
│   └── Modal/
│       ├── SaveDetailScreen
│       ├── CameraScreen
│       └── ShareScreen
│
├── Components/
│   ├── SaveCard (List item)
│   ├── CollectionCard
│   ├── VibeTag
│   ├── LocationBadge
│   └── PriceRange
│
├── Hooks/
│   ├── useSaves()
│   ├── useCollections()
│   ├── useSearch()
│   └── useAuth()
│
├── Store/ (Zustand)
│   ├── authStore
│   ├── saveStore
│   └── collectionStore
│
├── API/
│   ├── client.js (axios instance)
│   ├── auth.js (login, signup)
│   ├── saves.js (CRUD operations)
│   └── search.js (search API)
│
├── Utils/
│   ├── formatting (date, currency)
│   ├── validation (URL, input)
│   └── helpers
│
└── Assets/
    ├── images/
    ├── icons/
    └── theme.js
```

---

## MVP Features Checklist

### Phase 1 (Weeks 1-4)
- [ ] Auth (login/signup)
- [ ] Share content (camera/photo library)
- [ ] Display saves in feed
- [ ] View save details
- [ ] Search saves
- [ ] Create collections
- [ ] Add save to collection

### Phase 2 (Weeks 5-8)
- [ ] Edit save notes
- [ ] Filter by category/vibe/city
- [ ] Notifications
- [ ] Share to Instagram/WhatsApp
- [ ] Offline caching (SQLite)

### Phase 3 (Weeks 9-12)
- [ ] Recommendations feed
- [ ] Trip planning interface
- [ ] Price tracking alerts
- [ ] Advanced search
- [ ] User profile page

---

## Performance Optimization

### Image Optimization
```javascript
// Use FastImage for better caching
npm install react-native-fast-image

import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: save.image }}
  style={{ width: '100%', height: 200 }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### List Optimization
```javascript
// Use FlatList properly
<FlatList
  data={saves}
  renderItem={({ item }) => <SaveCard save={item} />}
  keyExtractor={item => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={20}
/>
```

### Code Splitting
```javascript
// Lazy load heavy screens
const SearchScreen = React.lazy(() => import('./screens/SearchScreen'));

<Suspense fallback={<LoadingScreen />}>
  <SearchScreen />
</Suspense>
```

---

## Testing Stack

### Unit Tests: Jest
```bash
npm install --save-dev jest @testing-library/react-native
```

### E2E Tests: Detox (Phase 2)
```bash
npm install --save-dev detox detox-cli
```

---

## Build & Deployment

### Development
```bash
expo start              # Start dev server
expo start --tunnel     # Tunnel for testing on physical device
```

### Testing
```bash
expo publish:rollout --channel=staging
# Share link with testers
```

### Production
```bash
# iOS
eas build --platform ios --auto-submit

# Android
eas build --platform android
```

---

## Total Development Cost

| Component | Cost | Timeline |
|-----------|------|----------|
| Frontend Development | 2-3 engineers | 4-6 weeks |
| Backend API | 1-2 engineers | 4-6 weeks |
| Design/UX | 1 designer | 2-3 weeks |
| QA/Testing | 1 QA | Ongoing |
| **Total Team** | **5 people** | **MVP in 6 weeks** |
| **Infrastructure** | ~$150/month | Ongoing |

---

## Key Takeaways

✅ **Use React Native + Expo for MVP**
- Fast iteration
- Code reuse
- Cost-effective

✅ **Use Zustand for state** (simple)

✅ **Use React Navigation** (proven pattern)

✅ **Use React Native Paper** (Material Design)

✅ **Use Axios + React Query** (data fetching)

❌ **Avoid custom native modules** (until Phase 2)

❌ **Don't use Reanimated/Gesture Handler** (until needed)

---

## Resources

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Zustand](https://github.com/pmndrs/zustand)

