const { parsePrice, parseRating } = require('../utils/parsers');

const extractTechMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'tech',
    price: parsePrice(text),
    rating: parseRating(text),

    // Tech-specific fields
    productType: extractProductType(text),
    brand: extractBrand(text),
    specs: extractSpecs(text),

    // Features
    os: extractOS(text),
    connectivity: extractConnectivity(text),
    battery: extractBatteryLife(text),

    // Quality signals
    isPopular: /trending|bestseller|top rated|must-have/i.test(text),
    isAffordable: /affordable|budget|cheap|deal/i.test(text),
    isPremium: /premium|luxury|high-end|flagship/i.test(text),

    // Use case
    bestFor: extractBestFor(text),
    setupDifficulty: extractSetupDifficulty(text),

    confidence: calculateConfidence(text),
  };
};

const extractProductType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  const typeList = [
    'laptop', 'phone', 'tablet', 'headphones', 'earbuds', 'watch',
    'camera', 'drone', 'monitor', 'keyboard', 'mouse', 'speaker',
    'router', 'charger', 'cable', 'stand'
  ];

  for (const type of typeList) {
    if (lower.includes(type)) {
      types.push(type);
    }
  }

  return types.length > 0 ? types : null;
};

const extractBrand = (text) => {
  const brands = [
    'Apple', 'Samsung', 'Google', 'Sony', 'Canon', 'Nikon',
    'Dell', 'HP', 'Lenovo', 'ASUS', 'Logitech', 'Anker'
  ];

  const lower = text.toLowerCase();
  for (const brand of brands) {
    if (lower.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  return null;
};

const extractSpecs = (text) => {
  const specs = {};
  const lower = text.toLowerCase();

  const cpuMatch = text.match(/(?:processor|cpu|chip|m\d+|snapdragon|exynos)\s*:?\s*([A-Za-z0-9\s.]+)/i);
  if (cpuMatch) specs.processor = cpuMatch[1].trim();

  const ramMatch = text.match(/(\d+)\s*(?:gb|giga)\s*ram/i);
  if (ramMatch) specs.ram = `${ramMatch[1]}GB`;

  const storageMatch = text.match(/(\d+)\s*(?:gb|tb|giga|tera)\s*(?:storage|ssd|hdd)/i);
  if (storageMatch) specs.storage = `${storageMatch[1]}GB`;

  return Object.keys(specs).length > 0 ? specs : null;
};

const extractOS = (text) => {
  const lower = text.toLowerCase();

  if (/ios|iphone|ipad/i.test(lower)) return 'iOS';
  if (/android/i.test(lower)) return 'Android';
  if (/windows|win10|win11/i.test(lower)) return 'Windows';
  if (/macos|mac os|apple/i.test(lower)) return 'macOS';
  if (/linux/i.test(lower)) return 'Linux';
  if (/chrome|chromeos/i.test(lower)) return 'ChromeOS';

  return null;
};

const extractConnectivity = (text) => {
  const connectivity = [];
  const lower = text.toLowerCase();

  if (/bluetooth|bt 5/i.test(lower)) connectivity.push('Bluetooth');
  if (/wifi|wi-fi|wireless/i.test(lower)) connectivity.push('WiFi');
  if (/usb|usb-c|type.c/i.test(lower)) connectivity.push('USB');
  if (/nfc/i.test(lower)) connectivity.push('NFC');
  if (/4g|5g|lte/i.test(lower)) connectivity.push('Cellular');

  return connectivity.length > 0 ? connectivity : null;
};

const extractBatteryLife = (text) => {
  const match = text.match(/(?:battery|battery life)\s*:?\s*(\d+)\s*(?:hours?|days?)/i);
  return match ? `${match[1]} ${match[2]}` : null;
};

const extractBestFor = (text) => {
  const contexts = [];
  const lower = text.toLowerCase();

  if (/work|office|professional|business|productivity/i.test(lower)) contexts.push('work');
  if (/gaming|game|gamer|fps/i.test(lower)) contexts.push('gaming');
  if (/photography|photo|camera|vlogging/i.test(lower)) contexts.push('content-creation');
  if (/travel|portable|mobile/i.test(lower)) contexts.push('travel');
  if (/budget|beginner|entry/i.test(lower)) contexts.push('beginners');
  if (/professional|creator|expert/i.test(lower)) contexts.push('professionals');

  return contexts.length > 0 ? contexts : null;
};

const extractSetupDifficulty = (text) => {
  const lower = text.toLowerCase();

  if (/plug.?n.?play|ready.?to.?use|easy|simple|no setup/i.test(lower)) return 'easy';
  if (/requires setup|some setup|configuration/i.test(lower)) return 'moderate';
  if (/complex|advanced setup|configuration/i.test(lower)) return 'complex';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/tech|gadget|device|electronics|hardware/i.test(text)) signals += 2;
  if (/price|cost|\$|₹/i.test(text)) signals += 1;
  if (/specs|processor|ram|storage/i.test(text)) signals += 1;
  if (/brand|model|version/i.test(text)) signals += 1;
  if (/rating|review|user|feature/i.test(text)) signals += 1;
  if (/battery|performance|speed/i.test(text)) signals += 1;
  if (/smartphone|laptop|computer|phone/i.test(text)) signals += 1;
  if (/trending|bestseller|popular/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractTechMetadata,
};
