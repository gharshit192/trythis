# TryThis Development Skills

Complete reference guides for all aspects of TryThis development.

## Quick Navigation

### 1. **UI Design System** [`ui-design-system.md`](./ui-design-system.md)
Learn how to build consistent, accessible, and beautiful UIs for TryThis.

**Topics:**
- Color palette and theming
- Typography scales
- Spacing and layout
- Reusable components
- Dark mode support
- Accessibility standards
- Animation guidelines
- Mobile platform rules

**Use when:**
- Building new screens
- Creating reusable components
- Implementing design system
- Supporting dark mode
- Ensuring accessibility

---

### 2. **Test Cases** [`test-cases.md`](./test-cases.md)
Comprehensive testing strategy with real code examples for frontend and backend.

**Topics:**
- Test structure and organization
- Unit tests (models, services)
- Integration tests (routes, database)
- Component tests (React Native)
- Screen tests (E2E)
- Hook tests
- Test coverage goals
- Running tests

**Use when:**
- Writing unit tests
- Creating integration tests
- Testing React components
- Building E2E tests
- Checking coverage goals

---

### 3. **Code Implementation** [`code-implementation.md`](./code-implementation.md)
Step-by-step guides to implementing features end-to-end, with working examples.

**Topics:**
- Feature implementation workflow
- Backend route creation
- Frontend screen implementation
- API integration
- State management
- Error handling patterns
- Common implementation patterns
- Code quality checklist

**Use when:**
- Starting a new feature
- Implementing backend endpoints
- Building frontend screens
- Integrating API calls
- Following best practices

---

## Workflow Examples

### Implementing a New Feature

```
1. Read: ui-design-system.md
   → Understand design requirements

2. Read: code-implementation.md → Feature Implementation Checklist
   → Follow the structured workflow

3. Write Backend
   → Reference: code-implementation.md → Backend Example
   → Test with: test-cases.md → Backend Tests

4. Write Frontend
   → Reference: code-implementation.md → Frontend Example
   → Test with: test-cases.md → Component Tests

5. Integration
   → Reference: test-cases.md → E2E Tests
   → Verify: code-implementation.md → Code Quality Checklist
```

### Building a Reusable Component

```
1. Design
   → Read: ui-design-system.md → Component Rules
   → Determine props and behavior

2. Implement
   → Read: code-implementation.md → Common Patterns
   → Use spacing, colors from design system

3. Test
   → Read: test-cases.md → Component Tests
   → Write tests for rendering and interactions

4. Document
   → Add usage examples
   → Document all props
```

### Setting Up Testing

```
1. Understand Structure
   → Read: test-cases.md → Testing Stack
   → Review directory organization

2. Write Tests
   → Choose test type (unit/integration/E2E)
   → Follow examples in test-cases.md
   → Run with: npm test

3. Check Coverage
   → Run: npm test -- --coverage
   → Aim for: test-cases.md → Test Coverage Goals
```

---

## File Organization

```
TryThis/
├── skills/
│   ├── README.md (this file)
│   ├── ui-design-system.md
│   ├── test-cases.md
│   └── code-implementation.md
├── frontend/
├── backend/
└── docs/
```

---

## Quick Reference

### Design System Constants

**Colors:** `frontend/src/theme/colors.js`
- Background: `#F8F7F4`
- Primary text: `#111111`
- Accent: `#6C63FF`

**Spacing:** `frontend/src/theme/spacing.js`
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px

**Border Radius:** `frontend/src/theme/spacing.js`
- xs: 8px, sm: 12px, md: 16px, lg: 20px, xl: 28px

### API Endpoints

**Creates Save:**
```
POST /saves
Body: { title, url, notes, sourceType }
Response: { status, data: Save }
```

**Get Saves:**
```
GET /saves
Response: { status, data: Save[] }
```

**Search:**
```
GET /search?q=query&category=travel
Response: { status, data: { total, saves, filters } }
```

### Component Patterns

**Basic Input:**
```javascript
<TextField
  label="Title"
  placeholder="Enter title..."
  value={value}
  onChangeText={setValue}
/>
```

**Save Card:**
```javascript
<SaveCard
  save={save}
  onPress={handlePress}
  showPrice={true}
  showIntent={true}
/>
```

**Empty State:**
```javascript
<EmptyState
  icon="inbox"
  title="No saves yet"
  description="Start saving things"
  action={{ label: 'Add Save', onPress: handleAdd }}
/>
```

---

## Tips & Tricks

### Debugging
- Backend: Set `LOG_LEVEL=debug` in .env
- Frontend: Use React Native Debugger
- Database: Use `docker-compose exec mongodb mongosh`

### Performance
- Use `FlatList` for long lists
- Memoize heavy components with `React.memo`
- Cache API responses with React Query
- Paginate large datasets

### Accessibility
- All interactive elements ≥44x44 points
- Text contrast ≥4.5:1 (normal) or 3:1 (large)
- Add accessible labels to all buttons
- Test with screen readers

### Testing Strategy
- Unit tests: Core logic and utilities
- Integration tests: API routes and critical paths
- E2E tests: Main user flows
- Target coverage: 70%+

---

## Related Documentation

- **Architecture:** `docs/architecture/overview.md`
- **API Spec:** `docs/api/endpoints.md`
- **Data Models:** `docs/data-models/schema.md`
- **Fetch System:** `docs/systems/fetch-system.md`
- **Retention Engine:** `docs/systems/retention-engine.md`

---

## Getting Help

Each skill file has:
- Real code examples
- Copy-paste patterns
- Common gotchas
- Links to related sections

**If something is unclear:**
1. Search within the skill files
2. Check `docs/` folder
3. Review existing code in `frontend/` or `backend/`
4. Ask in code review

---

**Last Updated:** 2026-05-15
**Version:** 1.0
