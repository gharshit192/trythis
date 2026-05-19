# Category-Wise Extraction System

## Overview

The TryThis extraction engine now uses **category-specific extractors** to intelligently extract metadata based on the type of content being saved.

Instead of generic extraction rules for all content, each category (Cafes, Restaurants, Travel, Shopping, Learning, etc.) has custom extraction logic tailored to what matters most for that category.

## Architecture

```
Save Content
    ↓
Classify Category (existing classifyCategory function)
    ↓
Extract Entities (NEW: category-aware)
    ├─→ If category is known:
    │   └─→ Route to category-specific extractor
    │       └─→ Extract category-relevant metadata
    └─→ If category unknown:
        └─→ Fall back to generic heuristics
```

## File Structure

```
backend/src/services/extractionEngine/
├── index.js                    (Main router, updated with category awareness)
├── categories/
│   ├── index.js               (Category extractor registry)
│   ├── cafes.js               (Cafe-specific extraction)
│   ├── restaurants.js         (Restaurant-specific extraction)
│   ├── travel.js              (Travel-specific extraction)
│   ├── shopping.js            (Shopping-specific extraction)
│   ├── learning.js            (Learning-specific extraction)
│   └── [future categories]    (Add more as needed)
└── utils/
    └── parsers.js             (Shared parsing utilities)
```

## Supported Categories

### 1. **Cafes** (`cafes.js`)

Extracts coffee-specific metadata:
- **Vibe:** cozy, aesthetic, peaceful, productive, etc.
- **Coffee Types:** specialty, third-wave, single origin, etc.
- **Specialties:** pastries, croissants, desserts, etc.
- **Atmosphere:** quiet level, ambiance, aesthetics
- **Social Context:** best for dates, work, study, solo, etc.
- **Practical:** WiFi availability, price, location

### 2. **Restaurants** (`restaurants.js`)

Extracts dining-specific metadata:
- **Cuisine:** detected from content (Italian, Chinese, Indian, etc.)
- **Meal Types:** breakfast, lunch, dinner, dessert
- **Dining Style:** casual, fine-dining, upscale, buffet, etc.
- **Atmosphere:** casual, romantic, family-friendly, etc.
- **Context:** dates, family, group, business, celebrations
- **Dietary:** vegan, vegetarian, gluten-free, halal, kosher
- **Signals:** signature dish, popularity, reservation required

### 3. **Travel** (`travel.js`)

Extracts trip-planning metadata:
- **Destination:** extracted location
- **Travel Type:** road-trip, beach, mountain, city, resort, etc.
- **Seasonality:** best season, weather, avoid times
- **Accommodation:** hotel, villa, camping, hostel, etc.
- **Transport:** flight, train, bus, car, walking, etc.
- **Difficulty:** easy, moderate, challenging
- **Context:** couples, families, solo, adventure, relaxation
- **Highlights:** scenic views, culture, food, wildlife, etc.

### 4. **Shopping** (`shopping.js`)

Extracts purchase-decision metadata:
- **Product Type:** fashion, tech, home, beauty, accessories, etc.
- **Brand:** extracted brand name
- **Price Range:** budget, mid-range, premium, luxury
- **Aesthetics:** detected visual style (minimalist, bohemian, etc.)
- **Availability:** in-stock, limited, pre-order, out-of-stock
- **Details:** material, colors, sizes
- **Signals:** on sale, popular, trending, has alternatives

### 5. **Learning** (`learning.js`)

Extracts educational metadata:
- **Skill Category:** coding, AI, business, design, productivity, etc.
- **Content Type:** course, video, article, book, podcast, workshop
- **Creator:** extracted creator/instructor name
- **Difficulty:** beginner, intermediate, advanced
- **Duration:** time to complete
- **Prerequisites:** what knowledge is needed
- **Learning Path:** structured, self-paced, project-based
- **Tools Required:** software/languages needed
- **Signals:** free, certificate, project-based, popular

## Implementation Details

### Parsing Utilities (`utils/parsers.js`)

Shared parsing functions used across all categories:
- `parsePrice()` - Extracts prices in multiple currencies
- `parseLocation()` - Extracts city/state from text
- `parseRating()` - Detects star ratings and scores
- `parseCuisine()` - Identifies cuisine types
- `parseAesthetic()` - Detects visual aesthetics
- `parseVibe()` - Detects atmosphere/mood keywords
- `parseDifficulty()` - Determines skill level
- `parseDuration()` - Extracts time/duration

### Category Router (`categories/index.js`)

Maps category names to extractors:
```javascript
const categoryExtractors = {
  cafes: extractCafeMetadata,
  restaurants: extractRestaurantMetadata,
  travel: extractTravelMetadata,
  shopping: extractShoppingMetadata,
  learning: extractLearningMetadata,
};
```

## Usage

### In the API Handler

```javascript
// When saving content:
const category = extractionEngine.classifyCategory(metadata.title + ' ' + metadata.description);

// Extract entities with category awareness
const extracted = await extractionEngine.extractEntities(
  metadata,
  category.category  // Pass the detected category
);

// Result includes category-specific fields:
// extracted.vibes, extracted.atmospheres, extracted.bestFor, etc.
```

## Extraction Flow

1. **Content Fetch** - Retrieve URL content and OG metadata
2. **Category Classification** - Determine primary category
3. **Category-Specific Extraction** - Use category extractor if available
4. **Confidence Scoring** - Each extractor calculates confidence
5. **Fallback** - Use heuristics if confidence is low
6. **Data Storage** - Save extracted metadata to MongoDB

## Adding New Categories

To add a new category (e.g., Finance):

1. **Create extractor file** (`backend/src/services/extractionEngine/categories/finance.js`)

```javascript
const extractFinanceMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'finance',
    // ... extract finance-specific fields
    confidence: calculateConfidence(text),
  };
};

module.exports = { extractFinanceMetadata };
```

2. **Register in router** (`categories/index.js`)

```javascript
const { extractFinanceMetadata } = require('./finance');

const categoryExtractors = {
  cafes: extractCafeMetadata,
  // ... other categories
  finance: extractFinanceMetadata,  // Add this
};
```

3. **Update category classifier** (`index.js`)

```javascript
const classifyCategory = (content) => {
  const keywords = {
    // ... existing categories
    finance: ['stock', 'investing', 'crypto', 'portfolio', 'trading'],  // Add this
  };
  // ... rest of classification logic
};
```

## Data Structure

Each category extractor returns a structured object:

```javascript
{
  primary_category: 'cafes',  // Main category
  
  // Generic fields (all categories)
  price: { raw: '$5', value: 5, currency: 'USD' },
  location: { city: 'Bangalore', state: 'KA', raw: '...' },
  
  // Category-specific fields
  vibes: ['cozy', 'peaceful'],
  aesthetics: ['minimalist', 'japandi'],
  hasWifi: true,
  bestFor: ['work', 'dates'],
  
  // Metadata
  confidence: 0.85,  // Confidence score (0-1)
  layer: 'category-specific',  // Which extraction layer was used
}
```

## Benefits

1. **Higher Accuracy** - Rules tailored to each category
2. **Richer Metadata** - Category-specific fields like "vibes", "cuisine", "skill level"
3. **Better Recommendations** - More informed data for personalization
4. **Scalability** - Easy to add new categories without changing core logic
5. **Semantic Understanding** - Captures what matters for each save type

## Confidence Scoring

Each extractor calculates a confidence score (0-1):
- **0.7+** - High confidence, use category-specific extraction
- **0.4-0.7** - Medium confidence, blend with heuristics
- **<0.4** - Low confidence, fall back to generic extraction

## Future Enhancements

1. **Multi-category Support** - Flag saves that belong to multiple categories
2. **Trait Extraction** - Extract cross-category traits (moods, aesthetics)
3. **Intent Detection** - Infer user intent (save for later, gift idea, learn next week)
4. **LLM Integration** - Use LLMs for complex extraction in category-specific context
5. **Fine-tuning** - Learn extraction patterns from user corrections

## Testing

Test category extractors with:

```bash
cd backend
npm test -- extractionEngine/categories
```

Or test specific category:

```bash
npm test -- categories/cafes.js
```
