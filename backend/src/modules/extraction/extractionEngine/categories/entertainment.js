const extractEntertainmentMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'entertainment',

    // Entertainment-specific fields
    mediaType: extractMediaType(text),
    genre: extractGenre(text),

    // Content details
    length: extractLength(text),
    rating: extractRating(text),

    // Viewing context
    mood: extractMood(text),
    idealFor: extractIdealFor(text),

    // Signals
    isPopular: /trending|viral|top rated|bestseller|popular/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractMediaType = (text) => {
  const lower = text.toLowerCase();

  if (/movie|film|cinema|flick|motion picture/i.test(lower)) return 'movie';
  if (/show|series|tv|television|episode/i.test(lower)) return 'tv';
  if (/book|novel|ebook|reading/i.test(lower)) return 'book';
  if (/podcast|audio|listen/i.test(lower)) return 'podcast';
  if (/anime|manga/i.test(lower)) return 'anime';
  if (/youtube|video|vlog|youtube/i.test(lower)) return 'youtube';
  if (/game|gaming|play/i.test(lower)) return 'game';

  return null;
};

const extractGenre = (text) => {
  const genres = [];
  const lower = text.toLowerCase();

  const genreList = [
    'action', 'comedy', 'drama', 'horror', 'romance', 'thriller',
    'sci-fi', 'fantasy', 'animation', 'documentary', 'mystery'
  ];

  for (const genre of genreList) {
    if (lower.includes(genre)) {
      genres.push(genre);
    }
  }

  return genres.length > 0 ? genres : null;
};

const extractLength = (text) => {
  const match = text.match(/(\d+)\s*(?:minute|min|hour|hr|episode|ep)/i);
  return match ? `${match[1]} min` : null;
};

const extractRating = (text) => {
  const match = text.match(/(\d\.?\d?)\s*\/\s*10|(\d\.?\d?)\s*star/i);
  return match ? parseFloat(match[1] || match[2]) : null;
};

const extractMood = (text) => {
  const moods = [];
  const lower = text.toLowerCase();

  if (/light|funny|comedy|laugh/i.test(lower)) moods.push('light');
  if (/intense|thrilling|suspense|scary/i.test(lower)) moods.push('intense');
  if (/emotional|touching|heartfelt/i.test(lower)) moods.push('emotional');
  if (/relaxing|chill|cozy|comfort/i.test(lower)) moods.push('relaxing');

  return moods.length > 0 ? moods : null;
};

const extractIdealFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/date|romantic|couple/i.test(lower)) contexts.push('date-night');
  if (/family|kids|children/i.test(lower)) contexts.push('family');
  if (/solo|alone|alone time/i.test(lower)) contexts.push('solo');
  if (/group|friends|party/i.test(lower)) contexts.push('group');

  return contexts.length > 0 ? contexts : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 8;

  if (/movie|show|book|podcast|anime|game|entertainment/i.test(text)) signals += 2;
  if (/genre|comedy|action|drama|romance/i.test(text)) signals += 1;
  if (/rating|star|review|score/i.test(text)) signals += 1;
  if (/length|duration|hour|minute|episode/i.test(text)) signals += 1;
  if (/mood|vibe|feeling|tone/i.test(text)) signals += 1;
  if (/watch|read|listen|play|view/i.test(text)) signals += 1;
  if (/trending|viral|popular|top/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractEntertainmentMetadata,
};
