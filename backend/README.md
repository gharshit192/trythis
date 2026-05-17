# TryThis Backend

Node.js/Express API for TryThis — Intent Infrastructure Platform.

---

## 📋 Overview

The backend provides:
- User authentication (signup/login)
- Content ingestion (Instagram, links, screenshots)
- Metadata extraction (OG tags, entity detection)
- Search & filtering
- Recommendations engine
- Notification system
- Behavioral tracking

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running on localhost:27017
- Redis running on localhost:6379

### Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

Server runs at `http://localhost:4000`

---

## 📁 Project Structure

```
src/
├── app.js              Express app setup
├── server.js           Server entry point
├── config/
│   ├── database.js     MongoDB connection
│   └── redis.js        Redis client
├── middleware/
│   ├── auth.js         JWT authentication
│   └── errorHandler.js Error handling
├── routes/             API endpoints
├── services/           Business logic
│   ├── fetchSystem/    Metadata extraction
│   ├── extractionEngine/
│   ├── retentionEngine/
│   └── ...
├── models/             MongoDB schemas
├── utils/
│   └── logger.js       Logging utility
└── data/               Mock data (dev)
```

---

## 🔌 API Endpoints

All endpoints require Bearer token in Authorization header.

### Authentication
- `POST /auth/signup` — Register user
- `POST /auth/login` — Login user
- `POST /auth/refresh` — Refresh token

### Saves
- `POST /shares` — Create new save
- `GET /saves` — Get user's saves
- `GET /saves/:id` — Get single save
- `PATCH /saves/:id` — Update save
- `DELETE /saves/:id` — Delete save

### Search
- `GET /search` — Search saves with filters

### Recommendations
- `GET /recommendations/:saveId` — Get recommendations

### Collections
- `GET /collections` — Get user's collections
- `POST /collections` — Create collection
- `POST /collections/:id/saves/:saveId` — Add save to collection

### Notifications
- `GET /notifications` — Get user's notifications
- `PATCH /notifications/:id` — Mark as read

[Full API Spec](../../docs/api/endpoints.md)

---

## 🛠️ Development

### Using Nodemon

```bash
npm run dev
```

Auto-restarts on file changes.

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

---

## 📊 Database

### MongoDB Collections

- `users` — User accounts
- `saves` — Saved content
- `collections` — User collections
- `recommendations` — Generated recommendations
- `notifications` — User notifications
- `user_behaviors` — Behavioral analytics

[Schema Details](../../docs/data-models/schema.md)

---

## 🔄 Queue System (Bull)

Uses Bull + Redis for async job processing:

```javascript
const queue = new Queue('extraction', {
  redis: { host: 'localhost', port: 6379 }
});

queue.process(async (job) => {
  // Process extraction job
});
```

---

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t trythis-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=mongodb://... \
  -e REDIS_URL=redis://... \
  trythis-backend
```

### Environment Variables

See `.env.example` for all variables.

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Error
Ensure MongoDB is running:
```bash
mongod  # or use docker-compose
```

### Redis Connection Error
Ensure Redis is running:
```bash
redis-server  # or use docker-compose
```

---

## 📚 Documentation

- [Architecture](../../docs/architecture/overview.md)
- [Fetch System](../../docs/systems/fetch-system.md)
- [Retention Engine](../../docs/systems/retention-engine.md)
- [API Specs](../../docs/api/endpoints.md)
- [Data Models](../../docs/data-models/schema.md)

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Write tests
4. Submit PR

---

**Built with ❤️ for people who intend to do things.**
