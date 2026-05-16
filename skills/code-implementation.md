# Code Implementation Skill

Step-by-step guide to implementing features in TryThis.

## Feature Implementation Checklist

Every feature should follow this workflow:

```
1. Requirements & Design
   ├── Write acceptance criteria
   ├── Create wireframes
   └── Determine API contract

2. Backend Implementation
   ├── Create/update models
   ├── Implement services
   ├── Create routes
   └── Write tests

3. Frontend Implementation
   ├── Create components
   ├── Hook to API
   ├── Add state management
   └── Write tests

4. Integration
   ├── E2E tests
   ├── Performance testing
   └── Accessibility audit

5. Deployment
   ├── Create PR
   ├── Code review
   └── Deploy to staging/production
```

## Example: Implement "Quick Save" Feature

### 1. Requirements
- User can quickly save a URL via share sheet
- Auto-extract metadata
- Show toast confirmation
- Navigate back to home after save

### 2. Backend: Create POST /saves Route

**File:** `backend/src/routes/saves.js`

```javascript
router.post('/', async (req, res) => {
  try {
    const { title, url, sourceType, notes } = req.body;

    // Validate input
    if (!url && !title) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'URL or title required' },
      });
    }

    // Fetch metadata from URL
    let metadata = { title, url };
    if (url) {
      metadata = await fetchSystem.fetchContent({ type: 'url', url });
      metadata = await fetchSystem.extractMetadata(metadata);
    }

    // Extract entities
    const extracted = await extractionEngine.extractEntities(metadata);
    const category = extractionEngine.classifyCategory(
      metadata.title + ' ' + metadata.description
    );

    // Create save document
    const save = new Save({
      userId: req.user.id,
      title: metadata.title || title,
      description: metadata.description || '',
      url: url,
      image: metadata.image,
      source: sourceType || 'url',
      category: category.category,
      metadata: {
        price: extracted.price,
        location: extracted.location,
        domain: extracted.domain,
      },
      notes: notes || '',
    });

    await save.save();

    // Track behavior
    await UserBehavior.create({
      userId: req.user.id,
      saveId: save._id,
      type: 'save',
      context: { source: 'quick_save' },
    });

    res.status(201).json({ status: 'success', data: save });
  } catch (error) {
    logger.error(`Save creation error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: { code: 'SAVE_ERROR', message: error.message },
    });
  }
});
```

### 3. Frontend: Create QuickSaveScreen

**File:** `frontend/src/screens/QuickSaveScreen.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as api from '../services/api';
import { colors, spacing } from '../theme';
import TextField from '../components/TextField';
import Button from '../components/Button';
import Toast from '../components/Toast';

const QuickSaveScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [url, setUrl] = useState(route.params?.url || '');
  const [title, setTitle] = useState(route.params?.title || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const handleSave = async () => {
    if (!url && !title) {
      setError('Please enter a URL or title');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.createSave({
        title: title || 'Untitled',
        url: url,
        notes: notes,
        sourceType: 'url',
      });

      if (response.status === 'success') {
        setToast({
          message: '✓ Saved successfully!',
          type: 'success',
          duration: 2000,
        });

        // Reset form
        setUrl('');
        setTitle('');
        setNotes('');

        // Navigate back after delay
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Save</Text>
        <Text style={styles.subtitle}>Save something to try later</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <TextField
          label="URL"
          placeholder="https://example.com"
          value={url}
          onChangeText={setUrl}
          editable={!loading}
          autoCapitalize="none"
        />

        <TextField
          label="Title"
          placeholder="What is this?"
          value={title}
          onChangeText={setTitle}
          editable={!loading}
          style={{ marginTop: spacing.lg }}
        />

        <TextField
          label="Notes (Optional)"
          placeholder="Add any notes..."
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={!loading}
          style={{ marginTop: spacing.lg, height: 100 }}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          label={loading ? 'Saving...' : 'Save'}
          onPress={handleSave}
          disabled={loading}
          style={{ marginTop: spacing.xl }}
          icon={loading ? <ActivityIndicator color={colors.surface} /> : null}
        />
      </ScrollView>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
          duration={toast.duration}
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
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.surface,
    fontSize: 14,
  },
});

export default QuickSaveScreen;
```

### 4. Add API Method

**File:** `frontend/src/services/api.js`

```javascript
import axios from 'axios';
import { getAuthToken } from './storage';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const createSave = async (saveData) => {
  const response = await api.post('/saves', saveData);
  return response.data;
};
```

### 5. Integrate Navigation

**File:** `frontend/src/navigation/RootNavigator.js`

```javascript
import QuickSaveScreen from '../screens/QuickSaveScreen';

const RootStack = createNativeStackNavigator();

export const RootNavigator = () => {
  return (
    <RootStack.Navigator>
      <RootStack.Group>
        {/* Bottom tabs stack */}
        <RootStack.Screen name="HomeTabs" component={HomeTabs} ... />
      </RootStack.Group>

      {/* Modal stack */}
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen
          name="QuickSave"
          component={QuickSaveScreen}
          options={{ headerShown: true }}
        />
      </RootStack.Group>
    </RootStack.Navigator>
  );
};
```

### 6. Add State Management

**File:** `frontend/src/store/appStore.js`

```javascript
import { create } from 'zustand';
import * as api from '../services/api';

export const useAppStore = create((set) => ({
  saves: [],
  loading: false,
  error: null,

  // Add save to local state
  addSave: (save) =>
    set((state) => ({
      saves: [save, ...state.saves],
    })),

  // Fetch saves from API
  fetchSaves: async () => {
    set({ loading: true });
    try {
      const response = await api.getSaves();
      set({ saves: response.data, loading: false, error: null });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // Create save
  createSave: async (saveData) => {
    set({ loading: true });
    try {
      const response = await api.createSave(saveData);
      set((state) => ({
        saves: [response.data, ...state.saves],
        loading: false,
        error: null,
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
```

### 7. Write Tests

**File:** `backend/__tests__/integration/saves.test.js`

```javascript
describe('POST /saves', () => {
  it('should create save from URL', async () => {
    const response = await request(app)
      .post('/saves')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://example.com/hotel',
        title: 'Hotel',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.url).toBe('https://example.com/hotel');
    expect(response.body.data.metadata.domain).toBe('example.com');
  });
});
```

**File:** `frontend/__tests__/screens/QuickSaveScreen.test.js`

```javascript
describe('QuickSaveScreen', () => {
  it('should save URL successfully', async () => {
    const mockApi = jest.mock('../../services/api');
    mockApi.createSave.mockResolvedValue({
      status: 'success',
      data: { _id: '1', title: 'Test' },
    });

    const { getByText, getByPlaceholderText } = render(<QuickSaveScreen />);

    fireEvent.changeText(
      getByPlaceholderText('https://example.com'),
      'https://test.com'
    );
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockApi.createSave).toHaveBeenCalled();
    });
  });
});
```

## Common Implementation Patterns

### Pattern 1: API Integration with Error Handling

```javascript
const handleFetch = async (apiCall) => {
  setLoading(true);
  setError(null);
  try {
    const response = await apiCall();
    setData(response.data);
  } catch (err) {
    setError(err.response?.data?.error?.message || 'Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

### Pattern 2: Optimistic Updates

```javascript
// Update UI immediately, revert on error
const handleDelete = async (itemId) => {
  const backup = items;
  setItems(items.filter((i) => i.id !== itemId));

  try {
    await api.deleteItem(itemId);
  } catch (error) {
    setItems(backup); // Revert on error
    Alert.alert('Error', 'Failed to delete');
  }
};
```

### Pattern 3: Debounced Search

```javascript
const [query, setQuery] = useState('');

const debouncedSearch = useCallback(
  debounce(async (text) => {
    if (text.length < 2) return;
    const results = await api.search(text);
    setResults(results);
  }, 300),
  []
);

useEffect(() => {
  debouncedSearch(query);
}, [query, debouncedSearch]);
```

### Pattern 4: Pagination

```javascript
const [page, setPage] = useState(1);
const [allSaves, setAllSaves] = useState([]);

const loadMore = async () => {
  const response = await api.getSaves({ page: page + 1, limit: 20 });
  setAllSaves([...allSaves, ...response.data]);
  setPage(page + 1);
};
```

### Pattern 5: Concurrent Requests

```javascript
// Fetch multiple resources in parallel
const fetchData = async () => {
  const [saves, collections, recommendations] = await Promise.all([
    api.getSaves(),
    api.getCollections(),
    api.getRecommendations(),
  ]);
  setData({ saves, collections, recommendations });
};
```

## Code Quality Checklist

- [ ] Code follows project conventions
- [ ] No hardcoded values (use constants)
- [ ] Error handling implemented
- [ ] Loading states shown
- [ ] Empty states handled
- [ ] Tests written (unit + integration)
- [ ] Code reviewed
- [ ] Accessibility checked
- [ ] Performance verified
- [ ] Documentation updated
