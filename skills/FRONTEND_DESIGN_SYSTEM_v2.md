# TryThis Frontend Design System v2
*Extracted from try-this-mockups — Exact HTML/CSS specifications for Create React App*

## 1. Color Palette

**Core Colors (CSS Variables):**
```css
--forest: #1B3A2F;              /* Primary - buttons, active states */
--forest-soft: #E8EFE9;         /* Light forest background */
--forest-faint: #F4F8F4;        /* Very light forest background */
--ink: #0E0E0C;                 /* Primary text */
--slate: #6B6B6B;               /* Secondary text */
--mute: #B0AEA7;                /* Tertiary text, disabled states */
--linen: #F7F6F2;               /* Light backgrounds */
--paper: #FFFFFF;               /* White surface, cards */
--hairline: #E0DDD3;            /* Borders */
--hairline-soft: #F0EEE6;       /* Soft borders */

/* Accent colors for thumbnails/backgrounds */
--sand: #C9A87C;
--sage: #B8C9B5;
--clay: #EBD9C2;
--mist: #C8D4D1;
--dune: #D9C9A8;
--amber-link: #B85C28;          /* Link color */
```

## 2. Typography System

**Fonts:**
- Display: Fraunces (serif) - headlines, titles
- Body: Inter (sans-serif) - body text, UI labels
- Import: `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600`

**Type Scale:**
```javascript
const typography = {
  // Screen titles (28px for login, 26px for signup)
  screenTitle: { fontSize: '26px', fontFamily: 'Fraunces', fontWeight: 600, letterSpacing: '-0.02em' },
  
  // Dialog/section titles
  dialogTitle: { fontSize: '20px', fontFamily: 'Fraunces', fontWeight: 600 },
  
  // Card titles (featured)
  cardTitle: { fontSize: '16px', fontFamily: 'Fraunces', fontWeight: 500 },
  
  // Body/content
  body: { fontSize: '14px', fontFamily: 'Inter', fontWeight: 400, lineHeight: '1.5' },
  bodySmall: { fontSize: '13px', fontFamily: 'Inter', fontWeight: 400 },
  
  // Labels & small text
  label: { fontSize: '13px', fontFamily: 'Inter', fontWeight: 400, color: '#6B6B6B' },
  caption: { fontSize: '12px', fontFamily: 'Inter', fontWeight: 400 },
  captionSmall: { fontSize: '11px', fontFamily: 'Inter', fontWeight: 400 },
  
  // Button text
  button: { fontSize: '15px', fontFamily: 'Inter', fontWeight: 500 },
  
  // Greeting/display
  greeting: { fontSize: '22px', fontFamily: 'Fraunces', fontWeight: 600 },
  greetingLabel: { fontSize: '13px', fontFamily: 'Inter', fontWeight: 400, color: '#6B6B6B' },
};
```

## 3. Spacing Scale

```javascript
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
};

// Common screen padding
--pad-screen: 20px;
```

## 4. Border Radius

```javascript
const radius = {
  xs: '8px',    /* Small buttons, input icons */
  sm: '12px',   /* Input fields, small cards */
  md: '12px',   /* Medium containers */
  lg: '16px',   /* Large cards, featured cards */
  xl: '20px',   /* Large containers */
  full: '999px',/* Pills, badges */
  circle: '50%',/* Avatars, FABs */
};
```

## 5. Component Specifications

### Authentication Screens (Login/Signup)

**Brand Mark:**
- Login: 56px × 56px square with 16px border radius
- Signup: 48px × 48px square with 14px border radius
- Background: var(--forest)
- Icon: Tabler bookmark icon, 28px (login) / 24px (signup), linen color

**Input Fields:**
- Height: 50px
- Background: var(--paper)
- Border: 1px solid var(--hairline)
- Border radius: 12px
- Padding: 0 16px
- Font: Inter, 15px
- Focused state: 1.5px solid var(--forest)
- Placeholder color: var(--mute)

**Buttons:**
- Primary:
  - Full width
  - Height: 52px
  - Background: var(--forest)
  - Color: var(--linen)
  - Border radius: 12px
  - Font: Inter, 15px, 500
  - Active: scale(0.98)
  
- Secondary:
  - Full width
  - Height: 50px
  - Background: var(--paper)
  - Border: 1px solid var(--hairline)
  - Border radius: 12px
  - Font: Inter, 14px, 500
  - Icon size: 18px

**Password Strength Indicator:**
- Bar with 4 segments
- Height: 3px
- Border radius: 2px
- Gap: 4px
- Filled: var(--forest), Unfilled: var(--hairline)

**Divider with Text:**
```html
<div style="display: flex; align-items: center; gap: 12px; margin: 22px 0;">
  <div style="flex: 1; height: 0.5px; background: var(--hairline);"></div>
  <span style="font-size: 11px; color: var(--mute); letter-spacing: 0.08em; text-transform: uppercase;">or</span>
  <div style="flex: 1; height: 0.5px; background: var(--hairline);"></div>
</div>
```

### Home Screen

**Search Bar:**
- Height: 44px
- Background: var(--linen)
- Border radius: 12px
- Padding: 0 14px
- Gap: 10px
- Icon: 16px, var(--slate)

**Pills (Filter Chips):**
- Padding: 6px 12px
- Border radius: 999px
- Font: 12px, Inter, 400
- Inactive: white bg, var(--hairline) border, var(--ink) text
- Active: var(--forest) bg, var(--forest) border, var(--linen) text, 500 weight

**Smart Banner:**
- Background: linear-gradient(135deg, var(--forest) 0%, #0a2118 100%)
- Border radius: 16px
- Padding: 16px
- Color: var(--linen)
- Icon circle: 40px, rounded 12px, background rgba(247,246,242,0.15)

**Featured Card (Large):**
- Border radius: 16px
- Background: var(--linen)
- Image height: 140px
- Source pill: Positioned top-left
- Bookmark button: Positioned top-right, 32px circle, white 0.95 opacity, forest icon

**Save Card Grid:**
- Grid: 2 columns
- Gap: 10px
- Card background: var(--paper)
- Card border: 0.5px solid var(--hairline)
- Card border radius: 14px
- Thumb height: 90px
- Icon size: 28px, var(--forest)

**Bottom Navigation:**
- Background: var(--paper)
- Border-top: 0.5px solid var(--hairline)
- Padding: 10px 20px 20px
- 5 items: Home, Search, FAB, Collections, Profile
- FAB: 50px circle, var(--forest), centered between Search and Collections
- Tab icon: 22px
- Tab label: 10px
- Inactive: var(--mute) color
- Active: var(--forest) color, 500 weight

### Add Save Modal (Bottom Sheet)

**Background:**
- Blur effect: rgba(14,14,12,0.45)
- Position: Fixed, flex column, justify-content flex-end

**Sheet Container:**
- Background: var(--paper)
- Border radius: 24px 24px 0 0
- Padding: 16px 20px 32px

**Handle:**
- Width: 36px
- Height: 4px
- Background: var(--hairline)
- Border radius: 2px
- Margin: 0 auto 18px

**Action Items:**
- Background: var(--linen)
- Border radius: 14px
- Padding: 14px
- Flex, align-items center
- Gap: 12px
- Margin-bottom: 8px
- Icon: 40px, border radius 10px
  - Primary icon bg: var(--forest), icon color: var(--linen)
  - Secondary icon bg: var(--paper), border: 0.5px var(--hairline)

**Clipboard Card:**
- Background: var(--paper)
- Border: 1px dashed var(--sand)
- Border radius: 12px
- Padding: 12px 14px

### Collections Screen

**Tab Navigation:**
- Gap: 18px
- Font: 13px
- Color: var(--slate)
- Active: var(--forest) color, 500 weight, border-bottom 2px var(--forest)
- Badge: 9px font, forest bg, linen text, padding 1px 5px

**AI Banner:**
- Background: var(--forest-faint)
- Border radius: 12px
- Padding: 12px 14px
- Icon color: var(--forest)

**Featured Large Card:**
- Background: var(--linen)
- Border radius: 16px
- Mosaic grid: 2fr 1fr columns
- Height: 130px
- Right stack: 2 rows of equal height

**Collection Cards Grid:**
- Grid: 2 columns
- Gap: 10px
- Border radius: 14px
- Thumb height: 90px
- Count badge: Positioned bottom-right, 10px font, dark bg 0.7
- Auto flag: Positioned top-left, 9px font, white bg 0.95

## 6. Icon System

**Icons:** Tabler Icons (v2.47.0)
- Load from CDN: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css`
- Common icons:
  - `ti-bookmark` (brand mark)
  - `ti-search`, `ti-home`, `ti-folder`, `ti-user` (navigation)
  - `ti-plus` (FAB, add button)
  - `ti-eye` (password reveal)
  - `ti-calendar-event`, `ti-mountain`, `ti-coffee`, `ti-tent`, `ti-confetti` (saves)
  - `ti-sparkles` (AI/auto)
  - `ti-arrow-right`, `ti-chevron-right` (navigation)
  - `ti-brand-apple`, `ti-brand-google` (social login)
  - `ti-signal-4g`, `ti-wifi`, `ti-battery-3` (status bar)

## 7. Phone Frame Structure

**Mockup Display (for browser testing):**
```css
.phone-frame {
  width: 380px;
  background: var(--paper);
  border-radius: 36px;
  border: 8px solid #0E0E0C;
  box-shadow: 0 30px 60px -20px rgba(14, 14, 12, 0.18), 
              0 10px 20px -10px rgba(14, 14, 12, 0.1);
  overflow: hidden;
  position: relative;
}

.phone-notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 26px;
  background: #0E0E0C;
  border-radius: 0 0 18px 18px;
  z-index: 10;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
```

## 8. Implementation Rules

### For Create React App:

1. **Import CSS variables in root style:**
```css
:root {
  --forest: #1B3A2F;
  --forest-soft: #E8EFE9;
  /* ... all variables ... */
}
```

2. **Component Structure:**
   - Each screen = one React component
   - Reusable sub-components: Button, Input, Card, Pill, Tab, Avatar
   - Props-driven configuration
   - No business logic in UI components

3. **Responsive Design:**
   - Base design: 380px width (mobile-first)
   - Use max-width containers for web
   - Media queries for tablet/desktop

4. **Safe Area:**
   - Account for iPhone notch with padding-top
   - Bottom tab navigation with safe area inset-bottom

5. **Dark Mode Support:**
   - All colors use CSS variables
   - Can swap values on `prefers-color-scheme: dark` media query

6. **Typography:**
   - Use font-family variables: `var(--font-display)`, `var(--font-body)`
   - Never hardcode font sizes—use the scale above
   - Always include letter-spacing for display fonts (-0.02em)

## 9. Screen Checklist (18 Total)

### Auth (2)
- [ ] 01-login.html
- [ ] 02-signup.html

### Onboarding (4)
- [ ] 03-onboarding-1.html
- [ ] 04-onboarding-2.html
- [ ] 05-onboarding-3.html
- [ ] 06-notification-permission.html

### Core App (4)
- [ ] 07-home-empty.html
- [ ] 08-home-feed.html
- [ ] 09-add-save.html
- [ ] 11-save-detail.html

### Collections (4)
- [ ] 12-collections.html
- [ ] 13-trip-collection.html
- [ ] 14-shopping-wishlist.html
- [ ] 15-food-nearby.html

### Activity & Profile (2)
- [ ] 16-notifications.html
- [ ] 17-search.html
- [ ] 18-profile.html

### Special (1)
- [ ] 10-screenshot-summary.html

## 10. CSS Reset & Base Styles

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background: #EFEDE6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv11', 'ss01';
}

html, body, #root {
  height: 100%;
}
```

## 11. Build Approach

1. Create base component library (Button, Input, Card, Pill, etc.)
2. Create layout components (Screen, Header, BottomNav, BottomSheet)
3. Build screens in order: Auth → Onboarding → Core → Collections → Activity
4. Test each screen in browser with phone frame wrapper
5. Use responsive design patterns for web, keep mobile-first

---

**Source:** try-this-mockups v1 (18 screens, extracted 2026-05-15)
**Target:** Create React App (frontend-app directory)
**Fonts:** Fraunces + Inter via Google Fonts
**Icons:** Tabler Icons CDN
