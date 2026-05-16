# Basic UI Testing Plan

What to test first to validate your React Native UI.

## Phase 1: Component Tests (Start Here)

Test individual components in isolation with mock data.

### 1. SaveCard Component

```javascript
// frontend/__tests__/components/SaveCard.test.js
import { render, screen, fireEvent } from '@testing-library/react-native';
import SaveCard from '../../src/components/SaveCard';

const mockSave = {
  _id: '1',
  title: 'Paris Hotel',
  description: 'Luxury 5-star hotel',
  image: 'https://via.placeholder.com/300x200',
  category: 'travel',
  metadata: {
    price: '$250',
    location: 'Paris, France',
    domain: 'booking.com',
  },
};

describe('SaveCard', () => {
  it('should render with title and description', () => {
    render(<SaveCard save={mockSave} />);
    
    expect(screen.getByText('Paris Hotel')).toBeTruthy();
    expect(screen.getByText('Luxury 5-star hotel')).toBeTruthy();
  });

  it('should display image', () => {
    render(<SaveCard save={mockSave} />);
    
    const image = screen.getByTestId('save-card-image');
    expect(image).toBeTruthy();
  });

  it('should display price when available', () => {
    render(<SaveCard save={mockSave} />);
    
    expect(screen.getByText('$250')).toBeTruthy();
  });

  it('should display location when available', () => {
    render(<SaveCard save={mockSave} />);
    
    expect(screen.getByText('Paris, France')).toBeTruthy();
  });

  it('should handle press action', () => {
    const mockPress = jest.fn();
    render(<SaveCard save={mockSave} onPress={mockPress} />);
    
    fireEvent.press(screen.getByTestId('save-card'));
    expect(mockPress).toHaveBeenCalledWith(mockSave);
  });

  it('should show loading skeleton', () => {
    render(<SaveCard loading={true} />);
    
    expect(screen.getByTestId('skeleton-loader')).toBeTruthy();
  });

  it('should display category badge', () => {
    render(<SaveCard save={mockSave} />);
    
    expect(screen.getByText('Travel')).toBeTruthy();
  });
});
```

**Run:**
```bash
cd frontend
npm test -- SaveCard.test.js
```

---

### 2. CollectionCard Component

```javascript
// frontend/__tests__/components/CollectionCard.test.js
import { render, screen } from '@testing-library/react-native';
import CollectionCard from '../../src/components/CollectionCard';

const mockCollection = {
  _id: '1',
  name: 'Weekend Trips',
  icon: '✈️',
  color: '#6C63FF',
  saves: ['save1', 'save2', 'save3'],
};

describe('CollectionCard', () => {
  it('should render collection name', () => {
    render(<CollectionCard collection={mockCollection} />);
    
    expect(screen.getByText('Weekend Trips')).toBeTruthy();
  });

  it('should display item count', () => {
    render(<CollectionCard collection={mockCollection} />);
    
    expect(screen.getByText('3 saves')).toBeTruthy();
  });

  it('should show collection icon', () => {
    render(<CollectionCard collection={mockCollection} />);
    
    expect(screen.getByText('✈️')).toBeTruthy();
  });

  it('should apply custom color', () => {
    const { getByTestId } = render(
      <CollectionCard collection={mockCollection} />
    );
    
    const card = getByTestId('collection-card');
    expect(card.props.style.backgroundColor).toBe('#6C63FF');
  });
});
```

---

### 3. SearchBar Component

```javascript
// frontend/__tests__/components/SearchBar.test.js
import { render, screen, fireEvent } from '@testing-library/react-native';
import SearchBar from '../../src/components/SearchBar';

describe('SearchBar', () => {
  it('should render input field', () => {
    render(<SearchBar />);
    
    expect(screen.getByPlaceholderText('Search saves...')).toBeTruthy();
  });

  it('should update text on input change', () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search saves...');
    
    fireEvent.changeText(input, 'paris hotels');
    expect(input.props.value).toBe('paris hotels');
  });

  it('should call onSubmit when search button pressed', () => {
    const mockSubmit = jest.fn();
    render(<SearchBar onSubmit={mockSubmit} />);
    
    fireEvent.press(screen.getByTestId('search-button'));
    expect(mockSubmit).toHaveBeenCalled();
  });

  it('should clear text on clear button press', () => {
    const { getByPlaceholderText, getByTestId } = render(<SearchBar />);
    const input = getByPlaceholderText('Search saves...');
    
    fireEvent.changeText(input, 'test');
    fireEvent.press(getByTestId('clear-button'));
    expect(input.props.value).toBe('');
  });
});
```

---

## Phase 2: Screen Tests (Next)

Test full screens with mock data and navigation.

### 1. HomeScreen Test

```javascript
// frontend/__tests__/screens/HomeScreen.test.js
import { render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';

// Mock API
jest.mock('../../src/services/api', () => ({
  getSaves: jest.fn(() =>
    Promise.resolve({
      status: 'success',
      data: [
        {
          _id: '1',
          title: 'Save 1',
          category: 'travel',
          metadata: { location: 'Paris' },
        },
        {
          _id: '2',
          title: 'Save 2',
          category: 'shopping',
          metadata: { price: '$50' },
        },
      ],
    })
  ),
}));

describe('HomeScreen', () => {
  it('should render screen title', () => {
    render(<HomeScreen />);
    
    expect(screen.getByText('Your Saves')).toBeTruthy();
  });

  it('should load and display saves', async () => {
    render(<HomeScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Save 1')).toBeTruthy();
      expect(screen.getByText('Save 2')).toBeTruthy();
    });
  });

  it('should show loading state initially', () => {
    render(<HomeScreen />);
    
    expect(screen.getByTestId('loading-skeleton')).toBeTruthy();
  });

  it('should display empty state when no saves', async () => {
    // Mock empty response
    jest.mock('../../src/services/api', () => ({
      getSaves: jest.fn(() =>
        Promise.resolve({ status: 'success', data: [] })
      ),
    }));

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('No saves yet')).toBeTruthy();
    });
  });

  it('should navigate to save detail on card press', async () => {
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

---

### 2. SearchScreen Test

```javascript
// frontend/__tests__/screens/SearchScreen.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SearchScreen from '../../src/screens/SearchScreen';

jest.mock('../../src/services/api', () => ({
  search: jest.fn((query) =>
    Promise.resolve({
      status: 'success',
      data: {
        total: 2,
        saves: [
          { _id: '1', title: 'Result 1' },
          { _id: '2', title: 'Result 2' },
        ],
      },
    })
  ),
}));

describe('SearchScreen', () => {
  it('should render search bar', () => {
    render(<SearchScreen />);
    
    expect(screen.getByPlaceholderText('Search saves...')).toBeTruthy();
  });

  it('should perform search on input', async () => {
    render(<SearchScreen />);
    
    const input = screen.getByPlaceholderText('Search saves...');
    fireEvent.changeText(input, 'paris');
    fireEvent.press(screen.getByTestId('search-button'));

    await waitFor(() => {
      expect(screen.getByText('Result 1')).toBeTruthy();
      expect(screen.getByText('Result 2')).toBeTruthy();
    });
  });

  it('should show search results count', async () => {
    render(<SearchScreen />);
    
    fireEvent.changeText(
      screen.getByPlaceholderText('Search saves...'),
      'test'
    );
    fireEvent.press(screen.getByTestId('search-button'));

    await waitFor(() => {
      expect(screen.getByText('2 results found')).toBeTruthy();
    });
  });

  it('should show empty results message', async () => {
    jest.mock('../../src/services/api', () => ({
      search: jest.fn(() =>
        Promise.resolve({ status: 'success', data: { total: 0, saves: [] } })
      ),
    }));

    render(<SearchScreen />);
    
    fireEvent.changeText(
      screen.getByPlaceholderText('Search saves...'),
      'nonexistent'
    );
    fireEvent.press(screen.getByTestId('search-button'));

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeTruthy();
    });
  });
});
```

---

### 3. CollectionsScreen Test

```javascript
// frontend/__tests__/screens/CollectionsScreen.test.js
import { render, screen, waitFor } from '@testing-library/react-native';
import CollectionsScreen from '../../src/screens/CollectionsScreen';

jest.mock('../../src/services/api', () => ({
  getCollections: jest.fn(() =>
    Promise.resolve({
      status: 'success',
      data: [
        {
          _id: '1',
          name: 'Weekend Trips',
          icon: '✈️',
          saves: ['1', '2', '3'],
        },
        {
          _id: '2',
          name: 'Products to Buy',
          icon: '🛍️',
          saves: ['4', '5'],
        },
      ],
    })
  ),
}));

describe('CollectionsScreen', () => {
  it('should render collections', async () => {
    render(<CollectionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Weekend Trips')).toBeTruthy();
      expect(screen.getByText('Products to Buy')).toBeTruthy();
    });
  });

  it('should display collection count', async () => {
    render(<CollectionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('✈️ 3 saves')).toBeTruthy();
      expect(screen.getByText('🛍️ 2 saves')).toBeTruthy();
    });
  });

  it('should show empty state when no collections', async () => {
    jest.mock('../../src/services/api', () => ({
      getCollections: jest.fn(() =>
        Promise.resolve({ status: 'success', data: [] })
      ),
    }));

    render(<CollectionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('No collections yet')).toBeTruthy();
    });
  });

  it('should show create collection button', () => {
    render(<CollectionsScreen />);

    expect(screen.getByText('+ New Collection')).toBeTruthy();
  });
});
```

---

## Phase 3: Navigation Tests

Test bottom tab navigation and screen transitions.

```javascript
// frontend/__tests__/navigation/RootNavigator.test.js
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from '../../src/navigation/RootNavigator';

describe('Root Navigation', () => {
  it('should render bottom tabs', () => {
    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    expect(screen.getByTestId('tab-home')).toBeTruthy();
    expect(screen.getByTestId('tab-search')).toBeTruthy();
    expect(screen.getByTestId('tab-save')).toBeTruthy();
    expect(screen.getByTestId('tab-collections')).toBeTruthy();
    expect(screen.getByTestId('tab-profile')).toBeTruthy();
  });

  it('should navigate between tabs', () => {
    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    // Initially on Home
    expect(screen.getByText('Your Saves')).toBeTruthy();

    // Tap Search tab
    fireEvent.press(screen.getByTestId('tab-search'));
    expect(screen.getByText('Search')).toBeTruthy();

    // Tap Collections tab
    fireEvent.press(screen.getByTestId('tab-collections'));
    expect(screen.getByText('Collections')).toBeTruthy();
  });

  it('should highlight active tab', () => {
    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

    const homeTab = screen.getByTestId('tab-home');
    expect(homeTab.props.style.color).toBe('#6C63FF'); // Active color
  });
});
```

---

## Testing Checklist

```
Component Tests:
✓ SaveCard renders correctly
✓ SaveCard handles press action
✓ CollectionCard displays name and count
✓ SearchBar handles input
✓ Empty states render
✓ Loading skeletons display
✓ Images load

Screen Tests:
✓ HomeScreen loads saves from API
✓ SearchScreen performs search
✓ CollectionsScreen displays collections
✓ Each screen shows correct data
✓ Empty states shown when needed
✓ Error handling works
✓ Navigation works

Navigation Tests:
✓ All tabs visible
✓ Tab switching works
✓ Active tab highlighted
✓ Back button works
```

---

## How to Run Tests

```bash
# Run all tests
cd frontend
npm test

# Run specific test file
npm test -- SaveCard.test.js

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage

# Update snapshots
npm test -- -u
```

---

## Quick Setup: Add testID to Components

Add `testID` props to your components so tests can find them:

```javascript
// SaveCard.js
<TouchableOpacity
  testID="save-card"
  onPress={() => onPress(save)}
>
  <Image testID="save-card-image" source={{ uri: image }} />
  <Text>{title}</Text>
</TouchableOpacity>

// SearchBar.js
<TextInput
  testID="search-input"
  placeholder="Search saves..."
/>
<TouchableOpacity testID="search-button">
  <Text>Search</Text>
</TouchableOpacity>

// RootNavigator.js
<BottomTab.Screen
  name="Home"
  component={HomeScreen}
  options={{
    tabBarTestID: 'tab-home',
  }}
/>
```

---

## Next: Run These Tests

```bash
cd frontend

# 1. Test components first
npm test -- SaveCard.test.js
npm test -- CollectionCard.test.js
npm test -- SearchBar.test.js

# 2. Then test screens
npm test -- HomeScreen.test.js
npm test -- SearchScreen.test.js
npm test -- CollectionsScreen.test.js

# 3. Then test navigation
npm test -- RootNavigator.test.js

# 4. Finally, full coverage
npm test -- --coverage
```

Start with **SaveCard** - it's the simplest and most reused component!
