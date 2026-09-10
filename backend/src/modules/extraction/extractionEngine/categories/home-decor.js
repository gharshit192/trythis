const { parsePrice, parseAesthetic } = require('../utils/parsers');

const extractHomeDecorMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'home-decor',
    price: parsePrice(text),
    aesthetics: parseAesthetic(text),

    // Decor-specific fields
    furnitureType: extractFurnitureType(text),
    room: extractRoom(text),
    style: extractStyle(text),

    // Material & Finish
    materials: extractMaterials(text),
    colors: extractColors(text),
    size: extractSize(text),

    // Practicality
    diy: /diy|do it yourself|craft|diy project/i.test(text),
    isPremium: /premium|luxury|high-end|designer/i.test(text),
    isAffordable: /affordable|budget|budget-friendly/i.test(text),

    // Signals
    isPopular: /trending|viral|pinterest|instagram/i.test(text),
    needsSpace: /spacious|large|big|needs space/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractFurnitureType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  const typeList = [
    'chair', 'table', 'sofa', 'bed', 'desk', 'shelf', 'cabinet',
    'lamp', 'rug', 'curtains', 'mirror', 'plant', 'decor'
  ];

  for (const type of typeList) {
    if (lower.includes(type)) {
      types.push(type);
    }
  }

  return types.length > 0 ? types : null;
};

const extractRoom = (text) => {
  const rooms = [];
  const lower = text.toLowerCase();

  if (/bedroom|bed|sleep/i.test(lower)) rooms.push('bedroom');
  if (/living|lounge|living room|couch/i.test(lower)) rooms.push('living-room');
  if (/kitchen|dining|eat|table/i.test(lower)) rooms.push('kitchen');
  if (/bathroom|bath/i.test(lower)) rooms.push('bathroom');
  if (/office|work|desk|study/i.test(lower)) rooms.push('office');
  if (/entryway|entrance|hallway|foyer/i.test(lower)) rooms.push('entryway');

  return rooms.length > 0 ? rooms : null;
};

const extractStyle = (text) => {
  const styles = [];
  const lower = text.toLowerCase();

  const styleList = [
    'minimalist', 'scandinavian', 'bohemian', 'industrial', 'modern',
    'vintage', 'rustic', 'japandi', 'contemporary', 'cozy', 'luxury'
  ];

  for (const style of styleList) {
    if (lower.includes(style)) {
      styles.push(style);
    }
  }

  return styles.length > 0 ? styles : null;
};

const extractMaterials = (text) => {
  const materials = [];
  const lower = text.toLowerCase();

  const materialList = [
    'wood', 'metal', 'ceramic', 'glass', 'fabric', 'leather',
    'marble', 'concrete', 'bamboo', 'rattan', 'wool'
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
    'black', 'white', 'grey', 'beige', 'navy', 'gold', 'brass',
    'copper', 'wood', 'natural', 'neutral', 'pastel'
  ];

  const lower = text.toLowerCase();
  for (const color of colorList) {
    if (lower.includes(color)) {
      colors.push(color);
    }
  }

  return colors.length > 0 ? colors : null;
};

const extractSize = (text) => {
  const lower = text.toLowerCase();

  if (/small|compact|space.saving|tiny/i.test(lower)) return 'small';
  if (/medium|standard|regular/i.test(lower)) return 'medium';
  if (/large|big|spacious|oversized/i.test(lower)) return 'large';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/home|decor|interior|furniture|room/i.test(text)) signals += 2;
  if (/price|cost|\$|₹/i.test(text)) signals += 1;
  if (/material|color|style|aesthetic/i.test(text)) signals += 1;
  if (/room|bedroom|living|kitchen/i.test(text)) signals += 1;
  if (/diy|craft|design|setup/i.test(text)) signals += 1;
  if (/minimalist|scandinavian|modern|vintage/i.test(text)) signals += 1;
  if (/furniture|sofa|chair|table|lamp/i.test(text)) signals += 1;
  if (/trendy|viral|pinterest|instagram/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractHomeDecorMetadata,
};
