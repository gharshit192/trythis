const { parsePrice } = require('../utils/parsers');

const extractFinanceMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'finance',
    price: parsePrice(text),

    // Finance-specific fields
    assetClass: extractAssetClass(text),
    riskLevel: extractRiskLevel(text),
    timeHorizon: extractTimeHorizon(text),

    // Sentiment
    sentiment: extractSentiment(text),
    trend: extractTrend(text),

    // Metrics
    metrics: extractMetrics(text),
    ticker: extractTicker(text),

    // Category
    financeCategory: extractFinanceCategory(text),

    confidence: calculateConfidence(text),
  };
};

const extractAssetClass = (text) => {
  const lower = text.toLowerCase();

  if (/stock|equities|shares|companies/i.test(lower)) return 'stocks';
  if (/bond|fixed income|securities/i.test(lower)) return 'bonds';
  if (/crypto|bitcoin|ethereum|blockchain/i.test(lower)) return 'crypto';
  if (/real estate|property|reits/i.test(lower)) return 'real-estate';
  if (/mutual fund|etf|index/i.test(lower)) return 'funds';
  if (/forex|currency|trading/i.test(lower)) return 'forex';

  return null;
};

const extractRiskLevel = (text) => {
  const lower = text.toLowerCase();

  if (/low risk|conservative|safe/i.test(lower)) return 'low';
  if (/medium|moderate|balanced/i.test(lower)) return 'medium';
  if (/high risk|aggressive|volatile/i.test(lower)) return 'high';

  return null;
};

const extractTimeHorizon = (text) => {
  const lower = text.toLowerCase();

  if (/short.?term|quick|day|week/i.test(lower)) return 'short-term';
  if (/medium|intermediate|month|quarter/i.test(lower)) return 'medium-term';
  if (/long.?term|years|decade/i.test(lower)) return 'long-term';

  return null;
};

const extractSentiment = (text) => {
  const lower = text.toLowerCase();

  if (/bullish|positive|buy|upside/i.test(lower)) return 'bullish';
  if (/bearish|negative|sell|downside|avoid/i.test(lower)) return 'bearish';
  if (/neutral|watch|hold/i.test(lower)) return 'neutral';

  return null;
};

const extractTrend = (text) => {
  const lower = text.toLowerCase();

  if (/up|rising|gain|growth|bullish/i.test(lower)) return 'up';
  if (/down|falling|loss|decline|bearish/i.test(lower)) return 'down';
  if (/stable|sideways|range/i.test(lower)) return 'stable';

  return null;
};

const extractMetrics = (text) => {
  const metrics = {};

  const peMatch = text.match(/P.?E\s*(?:ratio)?\s*[:=]?\s*([\d.]+)/i);
  if (peMatch) metrics.pe_ratio = parseFloat(peMatch[1]);

  const divMatch = text.match(/(?:dividend|yield)\s*[:=]?\s*([\d.]+)%?/i);
  if (divMatch) metrics.dividend_yield = parseFloat(divMatch[1]);

  return Object.keys(metrics).length > 0 ? metrics : null;
};

const extractTicker = (text) => {
  const match = text.match(/(?:ticker|symbol)\s*[:=]?\s*([A-Z]{1,4})/i);
  return match ? match[1] : null;
};

const extractFinanceCategory = (text) => {
  const categories = [];
  const lower = text.toLowerCase();

  if (/stock|market|equities/i.test(lower)) categories.push('stocks');
  if (/side.?hustle|income|earning|passive/i.test(lower)) categories.push('side-hustle');
  if (/investment|portfolio|trading/i.test(lower)) categories.push('investing');
  if (/tax|deduction|filing/i.test(lower)) categories.push('tax');
  if (/savings|budget|finance|money/i.test(lower)) categories.push('personal-finance');

  return categories.length > 0 ? categories : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 8;

  if (/finance|stock|invest|crypto|money|trading/i.test(text)) signals += 2;
  if (/price|return|gain|loss|\$|₹/i.test(text)) signals += 1;
  if (/sentiment|bullish|bearish|trend/i.test(text)) signals += 1;
  if (/asset|portfolio|market/i.test(text)) signals += 1;
  if (/risk|volatility|performance/i.test(text)) signals += 1;
  if (/ticker|symbol|company/i.test(text)) signals += 1;
  if (/analysis|strategy|opportunity/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractFinanceMetadata,
};
