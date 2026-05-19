const extractStartupsMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'startups',

    // Startup-specific fields
    ideaType: extractIdeaType(text),
    problem: extractProblem(text),
    market: extractMarket(text),

    // Business model
    businessModel: extractBusinessModel(text),
    stage: extractStage(text),

    // Opportunity signals
    isViable: /viable|potential|promising|opportunity/i.test(text),
    isUrgent: /urgent|timely|now|current|trending/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractIdeaType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/saas|software|app|platform/i.test(lower)) types.push('saas');
  if (/product|physical|hardware|device/i.test(lower)) types.push('product');
  if (/marketplace|service|platform|network/i.test(lower)) types.push('marketplace');
  if (/content|media|publishing/i.test(lower)) types.push('content');
  if (/ai|machine learning|automation/i.test(lower)) types.push('ai');

  return types.length > 0 ? types : null;
};

const extractProblem = (text) => {
  const match = text.match(/(?:solves?|addresses?|tackles?)\s+(.{20,100}?)(?:\.|,|$)/i);
  return match ? match[1].trim() : null;
};

const extractMarket = (text) => {
  const markets = [];
  const lower = text.toLowerCase();

  if (/b2b|business to business/i.test(lower)) markets.push('b2b');
  if (/b2c|business to consumer|consumer/i.test(lower)) markets.push('b2c');
  if (/d2c|direct to consumer/i.test(lower)) markets.push('d2c');
  if (/b2g|government/i.test(lower)) markets.push('b2g');

  return markets.length > 0 ? markets : null;
};

const extractBusinessModel = (text) => {
  const lower = text.toLowerCase();

  if (/subscription|saas|recurring/i.test(lower)) return 'subscription';
  if (/freemium|free.*premium/i.test(lower)) return 'freemium';
  if (/one.?time|purchase|pay.?once/i.test(lower)) return 'one-time';
  if (/marketplace|commission|transaction/i.test(lower)) return 'marketplace';
  if (/advertising|ad/i.test(lower)) return 'advertising';

  return null;
};

const extractStage = (text) => {
  const lower = text.toLowerCase();

  if (/idea|concept|early/i.test(lower)) return 'idea';
  if (/mvp|minimum viable|prototype|beta/i.test(lower)) return 'mvp';
  if (/launched?|live|in market/i.test(lower)) return 'launched';
  if (/growth|scaling|traction/i.test(lower)) return 'growth';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 8;

  if (/startup|idea|business|entrepreneurship|venture/i.test(text)) signals += 2;
  if (/problem|solution|solves|addresses/i.test(text)) signals += 1;
  if (/market|business model|revenue|monetization/i.test(text)) signals += 1;
  if (/stage|mvp|launch|growth/i.test(text)) signals += 1;
  if (/opportunity|viable|promising/i.test(text)) signals += 1;
  if (/idea|concept|innovation/i.test(text)) signals += 1;
  if (/b2b|b2c|marketplace|saas/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractStartupsMetadata,
};
