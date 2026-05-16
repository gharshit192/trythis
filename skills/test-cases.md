# Test Cases Skill

Comprehensive testing strategy and test suite for TryThis.

## Testing Stack

- **Backend:** Jest + Supertest
- **Frontend:** Jest + React Native Testing Library
- **E2E:** Detox or Cypress

## Backend Test Structure

```
backend/__tests__/
├── unit/
│   ├── models/
│   ├── services/
│   └── utils/
├── integration/
│   ├── routes/
│   └── database/
└── fixtures/
    └── mockData.js
```

### Unit Tests

#### User Model Tests

```javascript
describe('User Model', () => {
  it('should create user with valid data', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'hashedPassword',
      name: 'Test User',
    });
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
  });

  it('should fail with duplicate email', async () => {
    await User.create({ email: 'test@example.com', password: 'hash' });
    await expect(
      User.create({ email: 'test@example.com', password: 'hash2' })
    ).rejects.toThrow();
  });

  it('should hash password before saving', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'plainPassword',
    });
    expect(user.password).not.toBe('plainPassword');
  });
});
```

#### Save Service Tests

```javascript
describe('SaveService', () => {
  describe('createSave', () => {
    it('should create save with metadata extraction', async () => {
      const save = await SaveService.createSave({
        userId: userId,
        url: 'https://example.com',
        title: 'Test Save',
      });
      expect(save._id).toBeDefined();
      expect(save.metadata.domain).toBe('example.com');
      expect(save.category).toBeDefined();
    });

    it('should classify category correctly', async () => {
      const travelSave = await SaveService.createSave({
        userId: userId,
        title: 'Hotel in Paris',
        description: 'Book a hotel',
      });
      expect(travelSave.category).toBe('travel');
    });
  });

  describe('searchSaves', () => {
    it('should find saves by title', async () => {
      await SaveService.createSave({ userId, title: 'Pasta Recipe' });
      const results = await SaveService.searchSaves(userId, { q: 'Pasta' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Pasta');
    });

    it('should filter by category', async () => {
      const results = await SaveService.searchSaves(userId, {
        category: 'travel',
      });
      results.forEach((save) => expect(save.category).toBe('travel'));
    });

    it('should filter by location', async () => {
      const results = await SaveService.searchSaves(userId, {
        location: 'Paris',
      });
      results.forEach((save) => expect(save.metadata.location).toContain('Paris'));
    });
  });
});
```

#### Extraction Engine Tests

```javascript
describe('ExtractionEngine', () => {
  describe('classifyCategory', () => {
    it('should classify travel content', () => {
      const result = extractionEngine.classifyCategory(
        'Hotel in Barcelona beach resort vacation'
      );
      expect(result.category).toBe('travel');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify shopping content', () => {
      const result = extractionEngine.classifyCategory(
        'Buy Nike sneakers price $120 deal'
      );
      expect(result.category).toBe('shopping');
    });

    it('should default to general for unknown', () => {
      const result = extractionEngine.classifyCategory('Random text xyz');
      expect(result.category).toBe('general');
    });
  });
});
```

### Integration Tests

#### Auth Routes Tests

```javascript
describe('Auth Routes', () => {
  describe('POST /auth/signup', () => {
    it('should register new user', async () => {
      const response = await request(app).post('/auth/signup').send({
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('newuser@example.com');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ email: 'test@example.com', password: 'pass' });

      const response = await request(app).post('/auth/signup').send({
        email: 'test@example.com',
        password: 'pass2',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'hashedPassword',
      });

      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'hashedPassword',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
```

#### Saves Routes Tests

```javascript
describe('Saves Routes', () => {
  let authToken;
  let userId;

  beforeEach(async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'hash',
    });
    userId = user._id;
    authToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  });

  describe('POST /saves', () => {
    it('should create save with valid data', async () => {
      const response = await request(app)
        .post('/saves')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Paris Hotel',
          url: 'https://example.com/hotel',
          notes: 'For summer trip',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Paris Hotel');
      expect(response.body.data.userId).toBe(userId.toString());
    });

    it('should reject without authentication', async () => {
      const response = await request(app).post('/saves').send({
        title: 'Test Save',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /saves', () => {
    it('should return user saves', async () => {
      await Save.create({ userId, title: 'Save 1', url: 'http://a.com' });
      await Save.create({ userId, title: 'Save 2', url: 'http://b.com' });

      const response = await request(app)
        .get('/saves')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
    });

    it('should not return deleted saves', async () => {
      const save = await Save.create({
        userId,
        title: 'Active Save',
        url: 'http://a.com',
      });
      await Save.create({
        userId,
        title: 'Deleted Save',
        url: 'http://b.com',
        status: 'deleted',
      });

      const response = await request(app)
        .get('/saves')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Active Save');
    });
  });

  describe('DELETE /saves/:id', () => {
    it('should soft delete save', async () => {
      const save = await Save.create({
        userId,
        title: 'Save to Delete',
        url: 'http://example.com',
      });

      const response = await request(app)
        .delete(`/saves/${save._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const deletedSave = await Save.findById(save._id);
      expect(deletedSave.status).toBe('deleted');
    });

    it('should not delete other user saves', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'hash',
      });
      const save = await Save.create({
        userId: otherUser._id,
        title: 'Other User Save',
        url: 'http://example.com',
      });

      const response = await request(app)
        .delete(`/saves/${save._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
```

## Frontend Test Structure

```
frontend/__tests__/
├── components/
│   └── SaveCard.test.js
├── screens/
│   ├── HomeScreen.test.js
│   └── SearchScreen.test.js
├── hooks/
│   └── useSaves.test.js
└── utils/
    └── extractors.test.js
```

### Component Tests

```javascript
import { render, screen } from '@testing-library/react-native';
import SaveCard from '../SaveCard';

describe('SaveCard', () => {
  const mockSave = {
    _id: '1',
    title: 'Paris Hotel',
    description: 'Luxury hotel',
    image: 'http://example.com/image.jpg',
    category: 'travel',
    metadata: { price: '$200', location: 'Paris' },
  };

  it('should render save card', () => {
    render(<SaveCard save={mockSave} />);
    expect(screen.getByText('Paris Hotel')).toBeTruthy();
  });

  it('should display price when provided', () => {
    render(<SaveCard save={mockSave} showPrice={true} />);
    expect(screen.getByText('$200')).toBeTruthy();
  });

  it('should display location when provided', () => {
    render(<SaveCard save={mockSave} />);
    expect(screen.getByText('Paris')).toBeTruthy();
  });

  it('should handle press action', () => {
    const mockPress = jest.fn();
    render(<SaveCard save={mockSave} onPress={mockPress} />);
    fireEvent.press(screen.getByTestId('save-card'));
    expect(mockPress).toHaveBeenCalledWith(mockSave);
  });

  it('should show loading skeleton', () => {
    render(<SaveCard loading={true} />);
    expect(screen.getByTestId('save-card-skeleton')).toBeTruthy();
  });

  it('should display error state', () => {
    render(<SaveCard error="Failed to load save" />);
    expect(screen.getByText('Failed to load save')).toBeTruthy();
  });
});
```

### Screen Tests

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import * as api from '../../services/api';

jest.mock('../../services/api');

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render home screen', async () => {
    api.getSaves.mockResolvedValue([]);
    render(<HomeScreen />);
    expect(screen.getByText(/Recent Saves/)).toBeTruthy();
  });

  it('should load and display saves', async () => {
    const mockSaves = [
      { _id: '1', title: 'Save 1', category: 'travel' },
      { _id: '2', title: 'Save 2', category: 'shopping' },
    ];
    api.getSaves.mockResolvedValue(mockSaves);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save 1')).toBeTruthy();
      expect(screen.getByText('Save 2')).toBeTruthy();
    });
  });

  it('should show empty state when no saves', async () => {
    api.getSaves.mockResolvedValue([]);
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/No saves yet/)).toBeTruthy();
    });
  });

  it('should handle error state', async () => {
    api.getSaves.mockRejectedValue(new Error('Network error'));
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeTruthy();
    });
  });

  it('should navigate to save detail on press', async () => {
    const mockSaves = [
      { _id: '1', title: 'Save 1', category: 'travel' },
    ];
    api.getSaves.mockResolvedValue(mockSaves);
    const mockNavigation = { navigate: jest.fn() };

    render(<HomeScreen navigation={mockNavigation} />);

    await waitFor(() => {
      fireEvent.press(screen.getByText('Save 1'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SaveDetail', {
        saveId: '1',
      });
    });
  });
});
```

### Hook Tests

```javascript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import useSaves from '../useSaves';

jest.mock('../../services/api');

describe('useSaves Hook', () => {
  it('should fetch saves on mount', async () => {
    const { result } = renderHook(() => useSaves());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.saves).toBeDefined();
  });

  it('should handle refresh', async () => {
    const { result } = renderHook(() => useSaves());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.saves).toBeDefined();
  });

  it('should handle errors', async () => {
    const { result } = renderHook(() => useSaves());

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

## E2E Tests

```javascript
describe('Create and Retrieve Save', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should sign up and create save', async () => {
    // Signup
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Password123!');
    await element(by.label('Sign Up')).tap();

    // Wait for home screen
    await waitFor(element(by.text('Home')))
      .toBeVisible()
      .withTimeout(5000);

    // Add save
    await element(by.id('fab-save')).tap();
    await element(by.id('url-input')).typeText('https://example.com/hotel');
    await element(by.id('save-button')).tap();

    // Verify save appears in list
    await expect(element(by.text('Hotel'))).toBeVisible();
  });
});
```

## Test Coverage Goals

- **Unit tests:** 80%+ coverage
- **Integration tests:** Critical paths (auth, CRUD)
- **E2E tests:** Happy paths for main flows
- **Total coverage:** 70%+

## Running Tests

```bash
# Backend
npm test                    # Run all tests
npm test -- --watch       # Watch mode
npm test -- --coverage    # Coverage report

# Frontend
npm test -- --watchAll    # Watch mode
npm test -- --coverage    # Coverage report
```
