const { parsePrice, parseRating, parseAesthetic } = require('../utils/parsers');

const extractShoppingMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'shopping',
    price: parsePrice(text),
    rating: parseRating(text),

    // Product-specific fields
    productType: extractProductType(text),
    brand: extractBrand(text),
    aesthetics: parseAesthetic(text),

    // E-commerce signals
    priceRange: extractPriceRange(text),
    onSale: /sale|discount|deal|offer|off|limited time|hurry/i.test(text),
    availability: extractAvailability(text),

    // Shopping context
    bestFor: extractBestFor(text),
    season: extractSeason(text),

    // Product details
    material: extractMaterial(text),
    colors: extractColors(text),
    sizes: extractSizes(text),

    // Decision signals
    isPopular: /trending|bestseller|must-have|top-rated|popular/i.test(text),
    hasAlternatives: /alternative|similar|compare/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractProductType = (text) => {
  const types = {
    'fashion': ['dress', 'shirt', 'pants', 'jacket', 'shoes', 'outfit', 'clothing', 'apparel'],
    'tech': ['gadget', 'phone', 'laptop', 'headphones', 'device', 'camera', 'watch', 'electronic'],
    'home': ['decor', 'furniture', 'lamp', 'chair', 'table', 'rug', 'bedding', 'kitchen'],
    'beauty': ['skincare', 'makeup', 'cosmetics', 'serum', 'cream', 'lipstick', 'foundation'],
    'accessories': ['bag', 'purse', 'wallet', 'belt', 'scarf', 'jewelry', 'ring', 'necklace'],
    'sports': ['yoga', 'fitness', 'workout', 'shoes', 'gear', 'equipment', 'sports'],
  };

  const lower = text.toLowerCase();
  const matches = [];

  for (const [type, keywords] of Object.entries(types)) {
    if (keywords.some(k => lower.includes(k))) {
      matches.push(type);
    }
  }

  return matches.length > 0 ? matches : null;
};

const extractBrand = (text) => {
  const patterns = [
    /(?:by|from|brand)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:shirt|dress|shoes|bag|watch|phone|laptop)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
};

const extractPriceRange = (text) => {
  const lower = text.toLowerCase();

  if (/budget|cheap|affordable|under|inexpensive/i.test(lower)) return 'budget';
  if (/mid.range|moderate|standard/i.test(lower)) return 'mid-range';
  if (/premium|luxury|high-end|expensive|exclusive/i.test(lower)) return 'premium';
  if (/luxury|designer|haute|couture/i.test(lower)) return 'luxury';

  return null;
};

const extractAvailability = (text) => {
  const lower = text.toLowerCase();

  if (/out of stock|unavailable|sold out/i.test(lower)) return 'out-of-stock';
  if (/limited|limited edition|exclusive|rare/i.test(lower)) return 'limited';
  if (/pre.order|coming soon|available soon/i.test(lower)) return 'pre-order';
  if (/in stock|available|ready/i.test(lower)) return 'in-stock';

  return null;
};

const extractBestFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/date|romantic|gift|present/i.test(lower)) contexts.push('gifts');
  if (/work|office|professional|business/i.test(lower)) contexts.push('work');
  if (/casual|everyday|daily|comfortable/i.test(lower)) contexts.push('everyday');
  if (/party|night out|special occasion|formal/i.test(lower)) contexts.push('occasions');
  if (/travel|portable|compact/i.test(lower)) contexts.push('travel');
  if (/minimalist|aesthetic|aesthetic appeal/i.test(lower)) contexts.push('aesthetic');

  return contexts.length > 0 ? contexts : null;
};

const extractSeason = (text) => {
  const lower = text.toLowerCase();

  if (/summer|beach|light|cool/i.test(lower)) return 'summer';
  if (/winter|warm|heavy|cold/i.test(lower)) return 'winter';
  if (/spring|bloom|light/i.test(lower)) return 'spring';
  if (/autumn|fall|layer|cozy/i.test(lower)) return 'autumn';
  if (/all.season|year.round|versatile/i.test(lower)) return 'all-season';

  return null;
};

const extractMaterial = (text) => {
  const materials = [];
  const lower = text.toLowerCase();

  const materialList = [
    'cotton', 'silk', 'linen', 'polyester', 'wool', 'cashmere',
    'leather', 'suede', 'denim', 'bamboo', 'recycled', 'organic'
  ];

  for (const material of materialList) {
    if (lower.includes(material)) {
      materials.push(material);
    }
  }

  return materials.length > 0 ? materials : null;
};

const extractColors = (text) => {
  const colors = [];
  const colorList = [
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
    'brown', 'grey', 'gray', 'beige', 'navy', 'gold', 'silver'
  ];

  const lower = text.toLowerCase();
  for (const color of colorList) {
    if (lower.includes(color)) {
      colors.push(color);
    }
  }

  return colors.length > 0 ? colors : null;
};

const extractSizes = (text) => {
  const sizes = [];
  const lower = text.toLowerCase();

  const sizePatterns = [
    /(?:xs|extra small|small|s|medium|m|large|l|extra large|xl|xxl)/gi,
    /(?:one size|fits all|universal)/i,
  ];

  for (const pattern of sizePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      sizes.push(...matches);
    }
  }

  return sizes.length > 0 ? [...new Set(sizes)] : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/product|item|buy|shop|purchase|price|product|price/i.test(text)) signals += 2;
  if (/price|\$|₹|cost|amount/i.test(text)) signals += 1;
  if (/brand|designer|product name/i.test(text)) signals += 1;
  if (/rating|review|star|customer/i.test(text)) signals += 1;
  if (/material|color|size|style/i.test(text)) signals += 1;
  if (/sale|discount|deal|offer/i.test(text)) signals += 1;
  if (/aesthetic|vibe|style|look/i.test(text)) signals += 1;
  if (/fashion|clothing|dress|shoes/i.test(text)) signals += 1;
  if (/gift|present|give|receive/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractShoppingMetadata,
};
