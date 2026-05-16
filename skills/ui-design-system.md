# UI Design System Skill

Complete design system and component guidelines for TryThis mobile app.

## Color Palette

```javascript
// src/theme/colors.js
export const colors = {
  // Background
  background: '#F8F7F4',
  surface: '#FFFFFF',
  
  // Text
  text: {
    primary: '#111111',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    disabled: '#D1D5DB',
  },
  
  // Accent & Status
  primary: '#6C63FF',
  success: '#2ECC71',
  error: '#FF5A5F',
  warning: '#FFA500',
  info: '#3B82F6',
  
  // Borders
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
  },
};
```

## Typography

```javascript
// src/theme/typography.js
export const typography = {
  // Headings
  h1: { fontSize: 34, fontWeight: '700', lineHeight: 41 },
  h2: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h3: { fontSize: 24, fontWeight: '600', lineHeight: 29 },
  
  // Body
  body1: { fontSize: 17, fontWeight: '400', lineHeight: 22 },
  body2: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  
  // Metadata
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
};
```

## Spacing Scale

```javascript
// src/theme/spacing.js
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};
```

## Border Radius

```javascript
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};
```

## Shadow

```javascript
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};
```

## Core Components

### AppCard
Premium card component for displaying content.

```javascript
<AppCard onPress={onPress} shadow="md">
  <Image source={{ uri: image }} style={{ height: 200 }} />
  <Box padding="lg">
    <Text style={typography.h3}>{title}</Text>
    <Text style={typography.body2}>{description}</Text>
  </Box>
</AppCard>
```

### SaveCard
Specialized card for displaying saves.

```javascript
<SaveCard
  save={save}
  onPress={handlePress}
  showIntent
  showPrice
  onAddCollection={handleAddCollection}
/>
```

### CollectionCard
Display collections with item count.

```javascript
<CollectionCard
  collection={collection}
  onPress={handlePress}
  onEdit={handleEdit}
/>
```

### TagChip
Display tags with selection state.

```javascript
<TagChip
  label="Travel"
  onPress={handlePress}
  selected={isSelected}
  color={colors.primary}
/>
```

### SearchBar
Search input component.

```javascript
<SearchBar
  placeholder="Search saves..."
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSubmit={handleSearch}
/>
```

## Component Rules

1. **Reusable:** Components should work in multiple contexts
2. **Composable:** Build complex UIs from simple components
3. **No Business Logic:** Keep UI and logic separate
4. **Props-Driven:** Configuration via props, not state
5. **Accessible:** ARIA labels, sufficient color contrast
6. **Themeable:** Respect color and spacing variables

## Layout Patterns

### Safe Area
```javascript
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView style={{ flex: 1 }}>
  {/* Content */}
</SafeAreaView>
```

### Screen with Header
```javascript
<ScreenContainer>
  <ScreenHeader title="Saves" />
  <ScrollView contentInsetAdjustmentBehavior="automatic">
    {/* Content */}
  </ScrollView>
</ScreenContainer>
```

### Bottom Sheet Modal
```javascript
<BottomSheetModal
  ref={bottomSheetRef}
  snapPoints={[100, 200, 300]}
>
  {/* Content */}
</BottomSheetModal>
```

## Dark Mode Support

All colors use CSS custom properties for dark mode:

```javascript
// In components, always reference variables
style={{
  backgroundColor: colors.surface,
  color: colors.text.primary,
}}
```

Theme switching handled by context:

```javascript
<ThemeProvider theme={isDark ? 'dark' : 'light'}>
  <App />
</ThemeProvider>
```

## Accessibility

### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

### Touch Targets
- Minimum size: 44x44pt
- Minimum padding: 8pt around interactive elements

### Labels
Every interactive element needs:
```javascript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Add to collection"
  accessibilityRole="button"
  accessibilityState={{ disabled: isLoading }}
>
```

## Loading States

Use skeleton screens for better UX:

```javascript
<LoadingSkeleton count={3} height={200} />
```

## Empty States

Every list needs an empty state:

```javascript
{saves.length === 0 ? (
  <EmptyState
    icon="inbox"
    title="No saves yet"
    description="Start saving things to try later"
    action={{ label: 'Add First Save', onPress: handleAdd }}
  />
) : (
  <FlatList data={saves} ... />
)}
```

## Animation Guidelines

Use minimal, purposeful animations:

1. **Page transitions:** Fade (150ms)
2. **Item appearance:** Slide up (200ms)
3. **Button press:** Scale feedback (100ms)
4. **Loading:** Pulse (1.5s infinite)

Avoid:
- Bouncy animations
- Multiple simultaneous animations
- Animations longer than 300ms for micro-interactions

## Mobile Platform Rules

### iOS
- Use system font (SF Pro Display)
- Respect safe area
- Use Apple's color system (iOS 13+)

### Android
- Use Roboto font
- Respect Material Design 3
- Handle back button properly

## Testing Design System

```javascript
// Storybook setup for component preview
import { storiesOf } from '@storybook/react-native';
import { SaveCard } from './SaveCard';

storiesOf('Components/SaveCard', module)
  .add('Default', () => <SaveCard {...mockData} />)
  .add('With Price', () => <SaveCard {...mockData} showPrice />)
  .add('Loading', () => <SaveCard loading />)
  .add('Error', () => <SaveCard error="Failed to load" />);
```
