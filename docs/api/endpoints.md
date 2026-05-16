# API Specifications

**Base URL:** `https://api.trythis.app/v1`

---

## Authentication

All endpoints require Bearer token in Authorization header:

```
Authorization: Bearer {jwt_token}
```

---

## Shares / Saves

### Create Save

**Endpoint:** `POST /shares`

Create a new save from Instagram reel, link, or screenshot.

**Request:**
```javascript
{
  source: "instagram_reel",  // "instagram_reel" | "screenshot" | "link"
  url: "https://www.instagram.com/reel/DV-33CFE0X5/?igsh=...",
  
  // Optional - for screenshots/manual input
  metadata: {
    title: "Beautiful Cafe",
    description: "Hidden gem in Gurgaon"
  }
}
```

**Response:**
```javascript
{
  status: "success",
  data: {
    id: "507f1f77bcf86cd799439012",
    status: "pending",  // Processing extraction
    createdAt: "2026-05-15T10:30:00Z",
    willNotifyWhen: "2026-05-15T10:35:00Z"
  }
}
```

**Status Codes:**
- 201: Created successfully
- 400: Invalid input
- 401: Unauthorized
- 429: Rate limited

---

### Get All Saves

**Endpoint:** `GET /saves`

Fetch user's saves with filters and pagination.

**Query Parameters:**
```
page=1&limit=20
category=Travel
sortBy=createdAt&order=desc
collectionId=507f1f77bcf86cd799439020
searchQuery=goa
```

**Response:**
```javascript
{
  status: "success",
  data: {
    saves: [
      {
        id: "507f1f77bcf86cd799439012",
        title: "Beautiful Goa Trip",
        category: "Travel",
        image: "url",
        extracted: { ... },
        collections: ["Travel Dreams"],
        savedAt: "2026-05-15T10:30:00Z",
        revisitCount: 3
      },
      // ... more saves
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 145,
      pages: 8
    }
  }
}
```

---

### Get Single Save

**Endpoint:** `GET /saves/:saveId`

Get detailed view of a single save.

**Response:**
```javascript
{
  status: "success",
  data: {
    id: "507f1f77bcf86cd799439012",
    source: {
      type: "instagram_reel",
      url: "https://...",
      creatorHandle: "@travliv360"
    },
    metadata: { ... },
    extracted: { ... },
    collections: [ ... ],
    recommendations: [
      {
        saveId: "507f1f77bcf86cd799439045",
        reason: "Similar destination",
        score: 0.87
      }
    ],
    engagementStats: {
      revisitCount: 3,
      lastVisited: "2026-05-20T14:15:00Z",
      saved: true
    }
  }
}
```

---

### Update Save

**Endpoint:** `PATCH /saves/:saveId`

Update save metadata (add to collection, archive, etc.).

**Request:**
```javascript
{
  collectionIds: ["507f1f77bcf86cd799439020"],
  archived: false,
  customNotes: "Plan for November trip"
}
```

**Response:**
```javascript
{
  status: "success",
  data: {
    id: "507f1f77bcf86cd799439012",
    updated: true
  }
}
```

---

### Delete Save

**Endpoint:** `DELETE /saves/:saveId`

Delete a save.

**Response:**
```javascript
{
  status: "success",
  message: "Save deleted"
}
```

---

## Collections

### Create Collection

**Endpoint:** `POST /collections`

Create a new collection.

**Request:**
```javascript
{
  name: "Dream Trips",
  description: "Places I want to visit",
  icon: "🏖️",
  category: "Travel"
}
```

**Response:**
```javascript
{
  status: "success",
  data: {
    id: "507f1f77bcf86cd799439020",
    name: "Dream Trips",
    createdAt: "2026-05-15T10:30:00Z"
  }
}
```

---

### Get All Collections

**Endpoint:** `GET /collections`

Get user's collections.

**Response:**
```javascript
{
  status: "success",
  data: {
    collections: [
      {
        id: "507f1f77bcf86cd799439020",
        name: "Dream Trips",
        category: "Travel",
        saveCount: 42,
        saves: [  // Top 5 saves
          { id: "...", title: "..." }
        ],
        createdAt: "2026-05-10"
      }
    ]
  }
}
```

---

### Add Save to Collection

**Endpoint:** `POST /collections/:collectionId/saves/:saveId`

Add a save to collection.

**Response:**
```javascript
{
  status: "success",
  message: "Save added to collection"
}
```

---

## Recommendations

### Get Recommendations

**Endpoint:** `GET /recommendations/:saveId`

Get recommended saves based on one save.

**Query Parameters:**
```
limit=10
type=similarity  // similarity | nearby | seasonal | trending
```

**Response:**
```javascript
{
  status: "success",
  data: {
    source: {
      id: "507f1f77bcf86cd799439012",
      title: "Goa Beach Trip"
    },
    recommendations: [
      {
        id: "507f1f77bcf86cd799439045",
        title: "Gokarna Beach",
        category: "Travel",
        reason: "Similar beach destination",
        score: 0.87,
        image: "url"
      },
      {
        id: "507f1f77bcf86cd799439046",
        title: "Varkala Cliff Spot",
        reason: "Popular among Goa savers",
        score: 0.79
      }
    ]
  }
}
```

---

### Get Personalized Recommendations

**Endpoint:** `GET /recommendations/personalized`

Get AI recommendations for user based on their behavior.

**Query Parameters:**
```
limit=20
category=Travel
excludeSaved=true
```

**Response:**
```javascript
{
  status: "success",
  data: {
    recommendations: [
      {
        id: "507f1f77bcf86cd799439050",
        title: "Spiti Valley Trek",
        reason: "Popular among mountain lovers like you",
        score: 0.92
      }
    ],
    personalizationFactors: [
      "Your love for mountain destinations",
      "Similar price preferences"
    ]
  }
}
```

---

## Search

### Search Saves

**Endpoint:** `GET /search`

Full-text and semantic search across saves.

**Query Parameters:**
```
q=mountain+cafes
category=Food
city=Mumbai
vibe=Cozy
budget=Budget
limit=20
page=1
```

**Response:**
```javascript
{
  status: "success",
  data: {
    query: "mountain cafes",
    results: [
      {
        id: "507f1f77bcf86cd799439012",
        title: "Mountain Top Cafe",
        category: "Food",
        matchScore: 0.95,
        matchReasons: ["keyword match", "vibe match"]
      }
    ],
    totalResults: 15,
    queryTime: "45ms"
  }
}
```

---

## Notifications

### Get Notifications

**Endpoint:** `GET /notifications`

Get user's notifications.

**Query Parameters:**
```
read=false
type=price_drop  // price_drop | recommendation | resurfacing | etc.
limit=20
```

**Response:**
```javascript
{
  status: "success",
  data: {
    notifications: [
      {
        id: "507f1f77bcf86cd799439050",
        type: "price_drop",
        title: "Flights to Goa dropped 18%",
        body: "Starting at ₹4,200",
        relatedSaveId: "507f1f77bcf86cd799439012",
        createdAt: "2026-05-20T09:00:00Z",
        read: false
      }
    ]
  }
}
```

---

### Mark Notification as Read

**Endpoint:** `PATCH /notifications/:notificationId`

**Request:**
```javascript
{
  read: true
}
```

---

### Subscribe to Notifications

**Endpoint:** `POST /notifications/subscribe`

Subscribe to notification types.

**Request:**
```javascript
{
  types: ["price_drop", "nearby", "recommendation"],
  pushToken: "device_push_token"
}
```

---

## User Profile

### Get Profile

**Endpoint:** `GET /user`

Get current user's profile.

**Response:**
```javascript
{
  status: "success",
  data: {
    id: "507f1f77bcf86cd799439011",
    email: "user@example.com",
    username: "john_doe",
    statistics: {
      totalSaves: 145,
      totalCollections: 5,
      savesThisWeek: 12,
      averageRevisits: 2.3
    },
    preferences: {
      categories: ["Travel", "Food"],
      notificationsEnabled: true
    }
  }
}
```

---

### Update Profile

**Endpoint:** `PATCH /user`

Update user preferences.

**Request:**
```javascript
{
  preferences: {
    categories: ["Travel", "Food", "Shopping"],
    notificationsEnabled: true,
    theme: "dark"
  }
}
```

---

## Extraction Status

### Get Extraction Status

**Endpoint:** `GET /shares/:shareId/status`

Check extraction status of a pending save.

**Response:**
```javascript
{
  status: "success",
  data: {
    shareId: "507f1f77bcf86cd799439012",
    extractionStatus: "completed",  // pending | processing | completed | failed
    progress: 100,
    save: {
      id: "...",
      category: "Travel",
      extracted: { ... }
    }
  }
}
```

---

## Error Responses

### Standard Error Format

```javascript
{
  status: "error",
  error: {
    code: "INVALID_INPUT",
    message: "URL is invalid",
    details: {
      field: "url",
      reason: "Not a valid Instagram reel URL"
    }
  }
}
```

### Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| INVALID_INPUT | 400 | Input validation failed |
| UNAUTHORIZED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | User doesn't have access |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |
| EXTRACTION_FAILED | 500 | Failed to extract metadata |

---

## Rate Limiting

- **MVP:** 100 requests/minute per user
- **Phase 2:** 500 requests/minute per user

Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1621339200
```

---

## Next Steps

1. Review [Data Models](../data-models/schema.md)
2. Check [Extraction Engine](../systems/extraction-engine.md)
3. Read [MVP Timeline](../roadmap/mvp-timeline.md)
