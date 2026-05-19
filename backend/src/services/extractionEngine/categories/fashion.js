const { parsePrice, parseAesthetic } = require('../utils/parsers');

const extractFashionMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'fashion',
    price: parsePrice(text),
    aesthetics: parseAesthetic(text),

    // Fashion-specific fields
    clothingType: extractClothingType(text),
    style: extractStyle(text),
    genderCategory: extractGenderCategory(text),

    // Details
    colors: extractColors(text),
    materials: extractMaterials(text),
    season: extractSeason(text),
    occasion: extractOccasion(text),

    // Brand & Design
    brand: extractBrand(text),
    isDesigner: /designer|haute couture|luxury/i.test(text),
    isSustainable: /sustainable|eco|organic|ethical|fair trade/i.test(text),

    // Signals
    isPopular: /trending|bestseller|viral|must-have/i.test(text),
    isAffordable: /affordable|budget|cheap|sale|discount/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractClothingType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  const typeList = [
    'dress', 'shirt', 'pants', 'jeans', 'skirt', 'blouse', 'jacket',
    'coat', 'sweater', 'hoodie', 'shorts', 'leggings', 'suit', 'blazer'
  ];

  for (const type of typeList) {
    if (lower.includes(type)) {
      types.push(type);
    }
  }

  return types.length > 0 ? types : null;
};

const extractStyle = (text) => {
  const styles = [];
  const lower = text.toLowerCase();

  const styleList = [
    'casual', 'formal', 'streetwear', 'bohemian', 'minimalist',
    'vintage', 'contemporary', 'sporty', 'romantic', 'edgy', 'classic'
  ];

  for (const style of styleList) {
    if (lower.includes(style)) {
      styles.push(style);
    }
  }

  return styles.length > 0 ? styles : null;
};

const extractGenderCategory = (text) => {
  const lower = text.toLowerCase();

  if (/men|mens|men's|masculine|boy/i.test(lower)) return 'mens';
  if (/women|womens|women's|feminine|girl|ladies|lady/i.test(lower)) return 'womens';
  if (/unisex|gender.neutral|all genders|anyone/i.test(lower)) return 'unisex';
  if (/kids|children|child|boy|girl/i.test(lower)) return 'kids';

  return null;
};

const extractColors = (text) => {
  const colors = [];
  const colorList = [
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink',
    'purple', 'brown', 'grey', 'navy', 'gold', 'silver', 'beige'
  ];

  const lower = text.toLowerCase();
  for (const color of colorList) {
    if (lower.includes(color)) {
      colors.push(color);
    }
  }

  return colors.length > 0 ? colors : null;
};

const extractMaterials = (text) => {
  const materials = [];
  const lower = text.toLowerCase();

  const materialList = [
    'cotton', 'silk', 'wool', 'linen', 'polyester', 'denim',
    'leather', 'suede', 'cashmere', 'bamboo', 'organic', 'recycled'
  ];

  for (const material of materialList) {
    if (lower.includes(material)) {
      materials.push(material);
    }
  }

  return materials.length > 0 ? materials : null;
};

const extractSeason = (text) => {
  const lower = text.toLowerCase();

  if (/summer|light|beach|cool|breathable/i.test(lower)) return 'summer';
  if (/winter|warm|heavy|cozy|wool/i.test(lower)) return 'winter';
  if (/spring|light|bloom/i.test(lower)) return 'spring';
  if (/autumn|fall|layer/i.test(lower)) return 'autumn';
  if (/all.season|year.round|versatile/i.test(lower)) return 'all-season';

  return null;
};

const extractOccasion = (text) => {
  const occasions = [];
  const lower = text.toLowerCase();

  if (/casual|everyday|daily|work|office/i.test(lower)) occasions.push('casual');
  if (/formal|wedding|party|dinner|event/i.test(lower)) occasions.push('formal');
  if (/date|romantic|date night/i.test(lower)) occasions.push('date');
  if (/gym|workout|fitness|sports/i.test(lower)) occasions.push('active');
  if (/beach|vacation|travel/i.test(lower)) occasions.push('vacation');

  return occasions.length > 0 ? occasions : null;
};

const extractBrand = (text) => {
  const patterns = [
    /(?:by|from|brand)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:dress|shirt|pants|outfit)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/fashion|clothing|dress|outfit|apparel|style/i.test(text)) signals += 2;
  if (/price|cost|\$|₹/i.test(text)) signals += 1;
  if (/material|fabric|color|size/i.test(text)) signals += 1;
  if (/aesthetic|vibe|look|style/i.test(text)) signals += 1;
  if (/seasonal|summer|winter|weather/i.test(text)) signals += 1;
  if (/brand|designer|luxury|premium/i.test(text)) signals += 1;
  if (/casual|formal|occasion/i.test(text)) signals += 1;
  if (/trending|popular|viral|bestseller/i.test(text)) signals += 1;
  if (/sustainable|eco|ethical/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractFashionMetadata,
};
