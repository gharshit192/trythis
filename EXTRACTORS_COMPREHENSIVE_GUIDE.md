# TryThis Extractors — Comprehensive Technical Guide

**Last Updated:** May 25, 2026  
**Document Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Video Extractor](#video-extractor)
3. [Image/Screenshot Extractor](#imagescreenshot-extractor)
4. [Audio/Text Processing](#audiotext-processing)
5. [Libraries & Dependencies](#libraries--dependencies)
6. [Pricing Model](#pricing-model)
7. [Category-Wise Extraction](#category-wise-extraction)
8. [Data Processing Pipeline](#data-processing-pipeline)
9. [Error Handling & Recovery](#error-handling--recovery)

---

## Overview

TryThis has a three-pillar extraction architecture designed to convert unstructured user content (videos, images, links) into rich, actionable structured metadata:

| Pillar | Input | Output | Use Case |
|--------|-------|--------|----------|
| **Video Extractor** | YouTube, Instagram Reels, TikTok URLs | Transcription + Audio Analysis | Discover & extract intent from video content |
| **Image/Screenshot Extractor** | Uploaded screenshots | OCR + Visual Classification | Extract recipes, receipts, menus, product listings |
| **Category Router** | Any input | 18-category classification + structured data | Smart organization by food, travel, shopping, etc. |

---

## ⚡ Performance at a Glance

| Content Type | Current Time | Target | Status |
|--------------|--------------|--------|--------|
| **Short Video (15s)** | 30–45 sec | <20s | 🔴 Slow |
| **Medium Video (30s)** | 60–90 sec | <45s | 🔴 Slow |
| **Long Video (2–5m)** | 180–300 sec | <120s | 🔴 Slow |
| **Screenshot** | 3–8 sec | <3s | 🟡 Okay |
| **URL/Link** | 0.8–2 sec | <1s | 🟢 Good |

**Main Bottleneck:** Whisper transcription (40% of total time)  
**See:** [EXTRACTION_PERFORMANCE_METRICS.md](./EXTRACTION_PERFORMANCE_METRICS.md) for detailed analysis

---

## Video Extractor

### Architecture

The video extraction pipeline uses a **4-stage process** to transform a URL into structured metadata:

```
URL → Download (yt-dlp) → Audio Extract (ffmpeg) → Transcribe (Whisper) → Analyze (LLM) → Output
```

### Stage 1: Download — `yt-dlp`

**File:** `backend/src/services/mediaProcessor/index.js:59–77`

```javascript
downloadMergedMp4(sourceUrl, outPath)
```

**Library:** [`yt-dlp`](https://github.com/yt-dlp/yt-dlp)  
**What it does:**
- Downloads the best video+audio merged into MP4 (or audio-only fallback)
- Target: video ≤480p resolution to keep file sizes manageable
- Automatically detects and works around Instagram/YouTube rate limits

**Configuration:**
```bash
yt-dlp \
  -f 'bv*[height<=480]+ba/best[height<=480]/best'  # Best video+audio under 480p
  --merge-output-format 'mp4'                        # Output format
  --no-playlist                                      # Don't download playlists
  --socket-timeout '30'                              # Network timeout
  --retries '5'                                      # Retry failed requests 5x
  --retry-sleep 'linear=2:5'                        # Backoff: 2s, 3s, 4s, 5s, 5s
  --fragment-retries '3'                             # Retry fragments
  --extractor-args 'youtube:player_client=ios,web'  # Work around bot detection
```

**Timeout:** 120 seconds  
**Typical Time:** 
- Short video (15s): 8–12 sec
- Medium video (30s): 10–15 sec  
- Long video (5m): 20–40 sec

**Output:** Temporary MP4 file (discarded after pipeline completes)

### Stage 2: Audio Extraction — `ffmpeg`

**File:** `backend/src/services/mediaProcessor/index.js:79–82`

```javascript
extractWavForWhisper(mp4Path, wavPath)
```

**Library:** [`ffmpeg`](https://ffmpeg.org/)  
**What it does:**
- Extracts audio from MP4 in **Whisper's native format**: 16kHz mono PCM WAV
- This is the universal input format for all audio transcription

**Configuration:**
```bash
ffmpeg -y -i merged.mp4 \
  -ac 1              # Mono (1 audio channel)
  -ar 16000          # 16kHz sample rate (Whisper standard)
  -vn                # No video stream
  -acodec pcm_s16le  # PCM 16-bit signed little-endian
  audio.wav
```

**Timeout:** 60 seconds  
**Output:** WAV file (temporary, discarded after transcription)

### Stage 3: Transcription — `whisper-cli`

**File:** `backend/src/services/mediaProcessor/index.js:107–168`

```javascript
transcribeWithWhisper(wavPath, { durationSeconds, category })
```

**Library:** [`whisper-cli`](https://github.com/ggerganov/whisper.cpp)  
**What it does:**
- Converts speech → text using OpenAI's Whisper model running locally
- **Two-pass strategy** for non-English content:
  - **Pass 1 (Auto-detect):** Transcribe in original language, detect language
  - **Pass 2 (Translate):** Force-translate to English using detected language lock
  - **Skip Pass 2 if:** Original is already English (optimization)

**Model Selection:**
```javascript
// Recipes and videos >2 minutes get the better acoustic model
pickWhisperModel({ durationSeconds, category }) {
  const wantSmall = (category === 'food' || durationSeconds > 120);
  if (wantSmall && WHISPER_MODEL_SMALL exists) {
    return WHISPER_MODEL_SMALL;  // Base + larger model = better accuracy
  }
  return WHISPER_MODEL;           // Default: base model
}
```

**Configuration:**
```bash
whisper-cli \
  -m /path/to/model.bin    # Whisper model binary
  -f audio.wav             # Input WAV
  -otxt                    # Output text format
  -of output_base          # Output file prefix
  -l auto                  # Pass 1: auto-detect language
  # Pass 2 (if needed):
  -l <detected_lang>       # Lock language for better accuracy
  --translate              # Force English output
```

**Timeout:** 300 seconds (5 minutes)

**Typical Time (⚠️ Primary Bottleneck):**
- Short video (15s): 10–15 sec (Pass 1: 8–10s, Pass 2: 5–8s if needed)
- Medium video (30s): 20–30 sec
- Long video (5m): 90–180 sec (uses small model for better accuracy)
- English-only: ~50% faster (skips Pass 2 translation)

**Languages Supported:**
- Auto-detected from audio
- Special handling for Indian languages: Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Urdu
- Falls back to English when translation is empty (to avoid exposing unreadable Urdu script)

**Critical Logic — Non-English Script Safety:**
```javascript
// If audio is Hindi/Tamil/etc and translation is empty, mark as "partial"
// DO NOT fall back to original text (would expose unreadable script)
const isNonEnglishScript = ['hi', 'ur', 'ta', 'te', 'bn', 'pa', 'kn', 'ml', 'gu', 'mr'].includes(detectedLang);
const englishCandidate = translation.length >= 20 
  ? translation 
  : (isNonEnglishScript ? null : transcription);  // Null if no translation
```

**Output:**
```json
{
  "transcription": "original language text",
  "translation": "english version",
  "language": "hi"
}
```

### Stage 4: Analysis — Ollama LLM

**File:** `backend/src/services/mediaProcessor/index.js:273–315`  
**File:** `backend/src/services/audioAnalyzer/index.js`

```javascript
audioAnalyzer.extractAnalysis({
  transcript,      // English transcription
  visualText,      // OCR from video frames
  title,
  description,
  category,
  authorHandle
})
```

**What it does:**
- Uses local Ollama LLM to extract **structured intent** from transcript
- Returns typed metadata aligned to 7 content types: recipe, product, itinerary, event, article, listing, other

**LLM Prompt Strategy:**
- **System prompt:** Defines the exact JSON schema expected
- **User prompt:** Feeds transcript + OCR + metadata context
- **Temperature:** 0.1 (conservative, low hallucination)
- **Semantic validation:** If LLM claims type=recipe but has no ingredients, retry with explicit corrections

**Output Structure:**
```json
{
  "summary": "1-2 plain-English sentences",
  "keyPoints": [
    "3–6 short actionable bullets",
    "each ≤ 90 chars, no fluff"
  ],
  "audioTags": ["lowercase-hyphenated", "tags", "4–10 total"],
  "structuredData": {
    "type": "recipe|product|itinerary|event|article|listing|other",
    "recipe": {
      "isRecipe": true,
      "foodType": "recipe|restaurant|street_food|cafe|null",
      "title": "Rajma Chawal",
      "ingredients": ["tomato", "kidney beans"],
      "steps": ["roast spices", "add beans"],
      "cookingTime": "30 min",
      "servings": "4"
    },
    "product": {
      "name": "Cutwork Saree",
      "brand": "Woven Traditions",
      "price": 2500,
      "currency": "INR",
      "availableItems": ["Cutwork", "Laser Cut", "Digital Print"],
      "buyUrl": "https://amazon.in/..."  // Whitelisted domains only
    },
    "place": {
      "name": "Rajwada Cafe",
      "city": "Indore",
      "priceRange": "₹50–200"
    }
    // ... other types
  }
}
```

**Guardrails:**
- **Author handle stripping:** Tags matching the author's username are removed (e.g. "indian-food-lover-reels" from @indian.food.lover)
- **Generic tag filtering:** Stopwords like "business", "support", "service", "video", "reel" are stripped
- **URL whitelist:** Buy URLs are only kept if from allowlisted domains (Amazon, Flipkart, Myntra, Ajio, etc.) or literally mentioned in the transcript
- **Coordinate rejection:** LLM-generated GPS coordinates are never used (accuracy issues); Google Maps API querying is planned

---

## Image/Screenshot Extractor

### Architecture

```
Screenshot Upload → Persist Full + Thumbnail → OCR (Tesseract) → Classify Type → Route LLM → Output
```

### Stage 1: File Persistence

**File:** `backend/src/services/screenshotPipeline/index.js:42–56`

**Timing:** 0.5–1 second (includes thumbnail generation)

**What it does:**
- Saves uploaded images to `uploads/screenshots/full/<userId>-<timestamp>-<rand>.<ext>`
- Generates 256x256 JPEG thumbnail to `uploads/screenshots/thumb/...`
- Auto-deletes originals after 2 working days (keeps thumbnails forever)

**Storage:**
- **Full images:** Temporary (2 working day purge)
- **Thumbnails:** Permanent (shown in carousel on SaveDetail)

**Performance Notes:**
- Disk write: ~100–300ms
- Thumbnail generation (sharp): 100–200ms
- Multi-image: parallel writes for concurrent uploads

### Stage 2: OCR — Tesseract

**File:** `backend/src/services/frameExtractor/index.js:72–80`

**Library:** [`tesseract-ocr`](https://github.com/UB-Mannheim/tesseract/wiki)

**Timing:** 1–1.5 seconds per image
- Single image: 500–800ms
- 3 frames: 1.5–2.5 sec
- 4 frames: 2–3 sec
- 12 frames (max): 12–18 sec

```javascript
ocrFrame(framePath, langs)  // langs = 'eng' or 'eng+hin+tam' etc
```

**Configuration:**
```bash
tesseract input.jpg stdout \
  -l eng+hin        # Multilingual OCR (English + Hindi)
  --psm 6           # PSM 6 = sparse text (good for menus, receipts)
```

**Language Pack Support:**
- Dynamically checks installed packs: `tesseract --list-langs`
- Falls back to `eng` if requested language not installed
- Supports: eng, hin, tam, tel, ben, mar, guj, pan, kan, mal, urd

**Output:** Raw OCR text (may be noisy — misspellings, reversed words, Unicode artifacts)

**Parallelization Opportunity:** ⚡ Can run tesseract in parallel for multiple frames (currently sequential)

### Stage 3: Classification — Pattern Matching

**File:** `backend/src/services/screenshotAnalyzer/index.js:265–297`

**14 Screenshot Types:**

| Type | Patterns | Category | Intent |
|------|----------|----------|--------|
| **receipt** | "receipt", "invoice", "subtotal", "GST", "Swiggy/Zomato" | shopping | reference |
| **menu** | "starters", "veg", "combo", "₹", "served with" | food | reference |
| **product_page** | "add to cart", "buy now", "in stock", "Amazon/Flipkart" | shopping | buy |
| **social_post** | "retweet", "likes", "#hashtag", "@handle" | blog | reference |
| **article** | "min read", "published", "author", "subscribe", "paywall" | blog | read_later |
| **map** | "directions", "km away", "open now", "Google Maps" | travel | reference |
| **app_ui** | "dashboard", "settings", "Figma", "wireframe", "modal" | tech | inspiration |
| **code** | "function", "const", "git", "error", "console.log" | tech | reference |
| **price_list** | "rate card", "plan", "per month", "billed", "basic/premium" | shopping | reference |
| **finance** | "portfolio", "NIFTY", "mutual fund", "returns", "Zerodha" | other | reference |
| **travel_booking** | "PNR", "flight", "hotel", "check-in", "seat", "boarding pass" | travel | reference |
| **chat** | "WhatsApp", "delivered", "typing", "voice message" | other | reference |
| **notification** | "notification", "just now", "OTP", "order", "payment" | other | reference |
| **meme** | "when you", "POV", "lol", "Drake", "distracted boyfriend" | other | share |

**Scoring Algorithm:**
```javascript
for each type {
  matches = count how many patterns match
  score = min(matches / 3, 1)  // 3+ matches = high confidence
}
top_type = argmax(score)
confidence = top_type.score / 3
```

**Output:**
```json
{
  "type": "receipt",
  "category": "shopping",
  "intentType": "reference",
  "confidence": 0.87,
  "allMatches": [
    { "type": "receipt", "score": 3 },
    { "type": "product_page", "score": 1 }
  ]
}
```

### Stage 4: Type-Specific LLM Prompting

**File:** `backend/src/services/screenshotAnalyzer/index.js:300–425`

Each screenshot type gets a **specialized prompt** with targeted extraction instructions:

**Example: Receipt Prompt**
```
This is a receipt, invoice, or order confirmation.
Extract: merchant name, order ID, date, items purchased, total amount, payment method.
Return JSON: {
  "structuredData": {
    "type": "receipt",
    "merchant": "",
    "orderId": "",
    "date": "",
    "total": "",
    "currency": "INR",
    "items": [],
    "paymentMethod": ""
  }
}
```

**LLM Configuration:**
- **Temperature:** 0.1 (conservative)
- **Model:** Local Ollama
- **Schema validation:** Ensures JSON matches expected type schema

**Output:**
```json
{
  "title": "Swiggy Order #2402144 — ₹487",
  "summary": "Biryani order from Hyderabadi Hut delivered to Indore",
  "category": "shopping",
  "intentType": "reference",
  "structuredData": {
    "type": "receipt",
    "merchant": "Swiggy / Hyderabadi Hut",
    "orderId": "2402144",
    "date": "2025-02-14",
    "total": "₹487",
    "currency": "INR",
    "items": ["Chicken Biryani", "Raita", "Shorba"],
    "paymentMethod": "Credit Card"
  },
  "tags": ["biryani", "delivery", "hyderabadi-hut"]
}
```

---

## Audio/Text Processing

### Text Extraction Pipeline

**Parallel processing chain:**

1. **Transcription (Whisper)** — converts speech → English text
2. **Frame OCR (Tesseract)** — extracts on-screen text from 3–12 keyframes
3. **Merge** — concatenates both signals with separators
4. **Semantic Validation** — checks if extracted entities are coherent
5. **Hallucination Guard** — rejects nonsensical transcriptions

### Frame Extraction Strategy

**File:** `backend/src/services/mediaProcessor/index.js:361–368`

Extracts **evenly-spaced keyframes** based on video duration:

```javascript
pickFrameCount(durationSeconds) {
  if (d <= 15) return 3;      // 15s reel: 3 frames
  if (d <= 30) return 4;      // 30s reel: 4 frames
  if (d <= 60) return 6;      // 1min: 6 frames
  if (d <= 120) return 9;     // 2min: 9 frames
  return 12;                  // 2+min: 12 frames (max)
}
```

**ffmpeg extraction:**
```bash
ffmpeg -y -i video.mp4 \
  -vf 'fps=0.2,scale=1080:-2'  # fps = count/duration frames/sec
  -frames:v 4                    # Max 4 frames
  -q:v 4                         # Quality level 4 (good balance)
  frame-%03d.jpg
```

**Output:** Merged text like:
```
--- Frame 1 ---
Rajma Chawal Recipe
Ingredient: tomato, kidney beans

--- Frame 2 ---
Step 1: Roast cumin, bay leaf
```

### Hallucination Guard

**File:** `backend/src/utils/hallucinationGuard.js`

**What it does:**
- Detects when Whisper outputs gibberish (e.g. repeated phrases, nonsense sequences)
- Rejects transcriptions that fail common-sense checks
- Falls back to frame OCR if transcript is unreliable

---

## Libraries & Dependencies

### Core Backend Stack

| Library | Version | Purpose |
|---------|---------|---------|
| **Express.js** | 4.18.2 | HTTP server & routing |
| **Mongoose** | 7.5.0 | MongoDB ODM |
| **yt-dlp** | latest | Download videos from 1000+ platforms |
| **ffmpeg** | system | Extract audio/frames from videos |
| **ffprobe** | system | Probe video duration & format info |
| **whisper-cli** | ggerganov fork | Local speech-to-text |
| **tesseract** | system | Optical character recognition |
| **sharp** | 0.34.5 | Image processing (thumbnails, resize) |
| **Ollama** | local service | LLM inference (optional, graceful fallback) |
| **cheerio** | 1.0.0-rc.12 | HTML scraping for OpenGraph data |
| **open-graph-scraper** | 6.0.0 | Parse OG metadata from URLs |
| **bull** | 4.11.0 | Job queue (for batch processing) |
| **redis** | 4.6.0 | Cache & session store |
| **multer** | 2.1.1 | File upload handling |
| **axios** | 1.6.0 | HTTP client |

### System Dependencies

**Must be installed on server:**
```bash
# Ubuntu/Debian
sudo apt-get install \
  ffmpeg ffprobe        # Video processing
  tesseract-ocr         # OCR engine
  tesseract-ocr-*       # Language packs (hin, tam, tel, etc)
  git                   # Version control
  node npm              # JavaScript runtime

# Binary downloads
wget https://github.com/yt-dlp/yt-dlp/releases/download/latest/yt-dlp
chmod +x yt-dlp

wget https://github.com/ggerganov/whisper.cpp/releases/download/v1.x/whisper-cpp-linux-x64.tar.gz
tar xzf whisper-cpp-linux-x64.tar.gz
# Download model binary (e.g. ggml-base.bin, ggml-small.bin)

# Ollama (for LLM)
curl https://ollama.ai/install.sh | sh
ollama pull mistral  # or other model
```

### Environment Variables

```bash
# Video processing
ENABLE_MEDIA_PROCESSING=true      # Enable/disable entire pipeline
WHISPER_MODEL=/path/to/ggml-base.bin
WHISPER_MODEL_SMALL=/path/to/ggml-small.bin  # For recipes & long videos
UPLOADS_DIR=/data/trythis/uploads
PUBLIC_BASE_URL=https://api.trythis.io

# Screenshot handling
SCREENSHOT_PURGE_AFTER_DAYS=2     # Keep full images for 2 working days

# Ollama
OLLAMA_API_HOST=http://localhost:11434  # Local LLM service
```

---

## Pricing Model

### Cost Structure

TryThis operates on **near-zero marginal cost for media processing** due to local inference:

| Component | Cost | Notes |
|-----------|------|-------|
| **Video Download (yt-dlp)** | ~$0 | Open source, self-hosted |
| **Audio Extraction (ffmpeg)** | ~$0 | Open source, self-hosted |
| **Transcription (Whisper)** | ~$0 | Local model, no API calls |
| **Frame OCR (Tesseract)** | ~$0 | Open source, self-hosted |
| **LLM Analysis (Ollama)** | ~$0 | Local model inference |
| **Storage (MP4 temp)** | ~$0.001/save | 2-day retention, auto-purge |
| **Storage (thumbnails)** | ~$0.0001/save | Permanent, small JPEGs |
| **Bandwidth (downloads)** | ~$0.01–0.05/save | yt-dlp data transfer |

**Total Cost Per Video:** ~$0.01–0.05 in bandwidth, ~$0 in compute

### Historical Context

> **2023 vs. 2026:** Audio transcription went from ~$50,000/month (OpenAI API) to near-zero with local Whisper. LLM extraction went from expensive Claude API calls to free local Ollama inference. **This product was economically impossible in 2023.**

### Monetization Strategy

**Phase 1 (MVP):** Free tier only (all users can save & extract)

**Phase 2 (Month 3–6):** Freemium Model
```
Free Tier:
  - Unlimited saves
  - Basic extraction (transcript + summary)
  - 5 collections

Pro Tier (₹199–299/month):
  - Unlimited collections
  - Advanced triggers (location, price drop, seasonal)
  - Priority processing (faster extraction)
  - Shared planning (invite friends)
  - Price alerts on tracked products
```

**Phase 3 (Month 6+):** B2B & Partnerships
```
Brand Integrations:
  - Sponsored content cards (Airbnb on travel saves)
  - Featured placement (restaurant ads on food saves)
  - Revenue per trigger: ₹0.50–2 per qualified notification

Price Tracking:
  - Amazon/Flipkart affiliate links on price drops
  - 5–8% commission per purchase through TryThis link
```

---

## Category-Wise Extraction

### 18-Category Classifier

**File:** `backend/src/services/extractionEngine/index.js:14–44`

The classifier uses **keyword matching** to detect which of 18 categories a save belongs to:

| Category | Keywords | Confidence |
|----------|----------|------------|
| **cafes** | cafe, coffee, espresso, specialty coffee, barista, cold brew, cozy, aesthetic | 5+ matches = 0.8+ confidence |
| **restaurants** | restaurant, dining, cuisine, menu, bistro, fine dining | |
| **travel** | destination, trip, travel, journey, explore, vacation, trek | |
| **hotels** | hotel, accommodation, stay, resort, lodging, airbnb | |
| **shopping** | product, buy, shop, purchase, deal, store, price, order | |
| **fashion** | clothing, dress, apparel, designer, outfit, brand | |
| **home-decor** | furniture, decor, interior, design, decoration, lighting | |
| **tech** | gadget, device, laptop, phone, keyboard, headphone | |
| **learning** | course, learn, tutorial, class, training, certificate | |
| **recipes** | recipe, cooking, ingredient, prepare, bake, cuisine | |
| **finance** | stock, invest, crypto, trading, portfolio, mutual fund | |
| **fitness** | workout, exercise, gym, yoga, training, cardio | |
| **wellness** | meditation, mindfulness, health, well-being, relax | |
| **productivity** | productivity, tool, task, planner, organize, workflow | |
| **events** | event, concert, ticket, booking, festival, exhibition | |
| **experiences** | activity, adventure, workshop, tour, hands-on | |
| **startups** | startup, founder, venture, entrepreneurship, ycombinator | |
| **entertainment** | movie, series, watch, stream, netflix, music, podcast | |

**Algorithm:**
```javascript
classifyCategory(content) {
  bestMatch = null
  maxMatches = 0
  
  for each [extractor, keywords] {
    matches = keywords.filter(kw => content.toLowerCase().includes(kw))
    if matches.length > maxMatches {
      maxMatches = matches.length
      bestMatch = extractor
    }
  }
  
  confidence = min(maxMatches / 5, 1)  // 5+ matches = 1.0
  return { category: bestMatch, confidence }
}
```

### Category-Specific Extractors

**Files:** `backend/src/services/extractionEngine/categories/*.js`

Each category has custom extraction logic:

**Example: Recipes Extractor**
```javascript
// Extract cooking-specific metadata
extractRecipeMetadata(content) {
  return {
    primary_category: 'recipes',
    cuisine: parseCuisine(content),      // Italian, Indian, etc.
    cookingTime: parseDuration(content),  // "30 min"
    servings: parseServings(content),     // "4"
    difficulty: parseDifficulty(content), // "beginner"
    ingredients: extractIngredients(content),
    confidence: calculateConfidence(content)
  }
}
```

**Example: Travel Extractor**
```javascript
extractTravelMetadata(content) {
  return {
    primary_category: 'travel',
    destination: parseLocation(content),
    duration: parseDuration(content),     // "5 days"
    bestSeason: detectSeason(content),    // "monsoon"
    travelType: ['road-trip', 'beach', 'mountain'].find(...),
    difficulty: ['easy', 'moderate', 'challenging'],
    confidence: calculateConfidence(content)
  }
}
```

### Extraction Pipeline

**File:** `backend/src/services/extractionEngine/index.js:100–167`

```javascript
extractEntities(content, detectedCategory) {
  // Layer 1: Category-specific extraction
  if (detectedCategory) {
    result = extractByCategoryWrapper(detectedCategory, content)
    if result.confidence > 0.4 {
      return { ...result, layer: 'category-specific' }
    }
    
    // Layer 2: Fallback to other extractors in same family
    fallbacks = CATEGORY_TO_EXTRACTORS[detectedCategory]  // e.g. ['recipes', 'restaurants', 'cafes']
    for extractor in fallbacks {
      result = extractByCategoryWrapper(extractor, content)
      if result.confidence > best.confidence {
        best = result
      }
    }
    if best.confidence > 0.4 {
      return { ...best, layer: 'category-specific' }
    }
  }
  
  // Layer 3: Generic heuristics
  result = heuristics.extract(content)
  if result.confidence >= 0.7 {
    return { ...result, layer: 'heuristics' }
  }
  
  // Layer 4: Embeddings (placeholder)
  // Layer 5: LLM (placeholder)
  
  return { ...heuristics, layer: 'heuristics' }
}
```

**Confidence Thresholds:**
- **0.7+:** High confidence, use result directly
- **0.4–0.7:** Medium confidence, blend with fallbacks
- **<0.4:** Low confidence, fall back to heuristics

---

## Data Processing Pipeline

### End-to-End Flow

```
User saves Instagram Reel
  ↓
Backend detects source & URL
  ↓
Save record created with status="pending"
  ↓
mediaProcessor.enqueue(saveId)  [fire-and-forget]
  ↓
[Async background]
  1. Download video (yt-dlp)
     - Status: "processing"
  2. Extract audio (ffmpeg)
  3. Extract keyframes (ffmpeg)
  4. Transcribe (whisper-cli)
     - Check for hallucination
     - Handle non-English gracefully
  5. OCR frames (tesseract)
  6. LLM analysis (audioAnalyzer)
     - Extract structured data
     - Generate summary & tags
     - Validate semantics (retry if needed)
  7. Auto-categorize (classification engine)
  8. Merge results into Save record
  9. Update status: "done" or "partial"
  ↓
User sees enriched save with:
  - Transcript
  - Auto-generated title & summary
  - Structured metadata (recipe/product/itinerary/etc.)
  - Tags
  - Category
```

### Processing Status States

| State | Meaning | User Sees |
|-------|---------|-----------|
| **pending** | Queued, not started | Spinner: "Processing..." |
| **processing** | Download/transcription in progress | Spinner: "Processing..." |
| **done** | All stages completed successfully | Full enriched save |
| **partial** | Some stages failed but partial signal captured | Save + warning: "AI may have missed details. Tap to retry." |
| **failed** | Fatal error (e.g., video unreachable) | Save + error message + "Retry" button |

### Retry Logic

**Automatic retries:**
- yt-dlp: 5 retries with exponential backoff (2s → 3s → 4s → 5s → 5s)
- Whisper: 2 passes (auto-detect, then translate) with semantic validation retry

**Manual retry:**
- User taps "Retry" button on failed/partial save
- `mediaProcessor.processSave(saveId, { force: true })` reprocesses from stage 1

---

## Error Handling & Recovery

### Common Failure Modes

| Scenario | Root Cause | Recovery |
|----------|-----------|----------|
| **404 Not Found** | Video deleted from Instagram/YouTube | Mark as failed, show user message |
| **Rate Limited** | Too many downloads from same IP | yt-dlp retries with backoff |
| **Empty English Translation** | Hindi audio with no English output | Mark as "partial", skip LLM analysis |
| **LLM Unavailable** | Ollama service down | Return heuristics-only result |
| **Hallucination Detected** | Whisper outputs gibberish | Discard transcript, rely on frame OCR |
| **Timeout** | Process takes >5 minutes | Kill process, mark as failed |

### Graceful Degradation

The system degrades **one stage at a time**:

```
Full Result:          Transcript + Analysis + Tags + Summary
├─ No LLM:           Transcript only (no analysis)
├─ No Transcript:    Frame OCR only (visual analysis)
├─ No Frames:        Transcript only (audio analysis)
└─ No Signals:       Default result (status="partial")
```

### Monitoring & Logging

**File:** `backend/src/utils/logger.js`

```javascript
logger.info(`[mediaProcessor ${saveId}] stage completed`)
logger.warn(`[mediaProcessor ${saveId}] hallucination detected`)
logger.error(`[mediaProcessor ${saveId}] fatal error: ${err.message}`)
```

**Metrics:**
- `processingStatus` — tracks each save's completion state
- `processingError` — stores error message for debugging
- `aiAnalysis.flags` — surface guardrail triggers (e.g. `buyUrlStripped: true`)

---

## Appendix: Quick Configuration Checklist

### Before Launch

- [ ] Install system dependencies: `ffmpeg`, `tesseract`, `yt-dlp`
- [ ] Download Whisper models (base + small): ~400MB each
- [ ] Start Ollama service: `ollama serve`
- [ ] Set `UPLOADS_DIR` to persistent storage (not temp)
- [ ] Set `PUBLIC_BASE_URL` to production domain
- [ ] Configure `WHISPER_MODEL` and `WHISPER_MODEL_SMALL` paths
- [ ] Test end-to-end: save a YouTube link, verify extraction completes in <5 min
- [ ] Set up monitoring for pipeline failures
- [ ] Configure screenshot purge job (runs nightly)

### Performance Tuning

- **CPU:** Whisper uses 1–2 cores per video; queue serializes to avoid overload
- **RAM:** Keep 2GB+ free for concurrent ffmpeg + tesseract + whisper processes
- **Disk:** Temporary files (MP4, WAV) are cleaned up after each save
- **Network:** yt-dlp downloads up to 480p; ~30–200MB per video

### Cost Optimization

- Use **base Whisper model** for most videos (10x faster than small)
- Use **small model** only for food category & videos >2 min
- **Batch OCR:** Extract frames in parallel where possible
- **Cache transcripts:** If same video ID seen again, reuse transcript

---

## Performance Summary

### Current Extraction Times (Actual Measurements)

```
SHORT VIDEO (15-30 seconds):
  Download (yt-dlp)           8-15 sec
  Audio Extract (ffmpeg)      2-3 sec
  Transcription (Whisper)     10-30 sec ⚠️ Bottleneck
  Frame OCR (Tesseract)       3-5 sec
  LLM Analysis (Ollama)       2-4 sec
  Database Update             50-100 ms
  ────────────────────────────────────
  TOTAL:                      27-57 sec
  Most Likely:                35-45 sec

LONG VIDEO (2-5 minutes):
  Download (yt-dlp)           20-40 sec
  Audio Extract (ffmpeg)      3-5 sec
  Transcription (Whisper)     90-180 sec ⚠️ Bottleneck
  Frame OCR (Tesseract)       12-18 sec
  LLM Analysis (Ollama)       3-5 sec
  Database Update             100-200 ms
  ────────────────────────────────────
  TOTAL:                      130-250 sec
  Most Likely:                180 sec (3 minutes)

SCREENSHOT:
  File Upload & Persist       1-2 sec
  OCR (Tesseract)             1-3 sec
  Type Classification         <100 ms
  LLM Analysis                1-2 sec
  Database Update             50-100 ms
  ────────────────────────────────────
  TOTAL:                      4-8 sec
  Most Likely:                6 sec
```

### Optimization Opportunities

**High Priority (25-35% speedup):**
1. ⚡ Parallelize frame extraction + OCR (currently sequential)
2. ⚡ Cache transcriptions by video fingerprint (save 8-15s on duplicates)
3. ⚡ Skip Whisper Pass 2 when English detected (saves 5-10s)

**Medium Priority (15-20% speedup):**
1. 🔄 Stream-based video download + ffmpeg piping (no temp file write)
2. 🔄 Batch LLM requests (5-10 saves in parallel)
3. 🔄 Dynamic frame count based on duration (currently fixed)

**See:** [EXTRACTION_PERFORMANCE_METRICS.md](./EXTRACTION_PERFORMANCE_METRICS.md) for detailed analysis, benchmarking guide, and optimization roadmap.

---

## References

- **yt-dlp:** https://github.com/yt-dlp/yt-dlp
- **Whisper.cpp:** https://github.com/ggerganov/whisper.cpp
- **FFmpeg:** https://ffmpeg.org/
- **Tesseract:** https://github.com/UB-Mannheim/tesseract/wiki
- **Ollama:** https://ollama.ai/
- **TryThis Docs:** `/docs/TryThisProductSTrategy.md`
- **Performance Metrics:** `./EXTRACTION_PERFORMANCE_METRICS.md`

---

**Document Status:** Complete  
**Last Reviewed:** May 25, 2026  
**Last Updated:** Added performance metrics & timing data  
**Owner:** TryThis Backend Team
