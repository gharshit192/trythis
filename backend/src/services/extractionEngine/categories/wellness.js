const extractWellnessMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'wellness',

    // Wellness-specific fields
    wellnessCategory: extractWellnessCategory(text),
    focus: extractFocus(text),
    duration: extractDuration(text),

    // Practice details
    difficulty: extractDifficulty(text),
    isForBeginners: /beginner|start|easy|new/i.test(text),

    // Lifestyle aspect
    frequency: extractFrequency(text),
    timeOfDay: extractTimeOfDay(text),

    // Benefits
    benefits: extractBenefits(text),

    confidence: calculateConfidence(text),
  };
};

const extractWellnessCategory = (text) => {
  const categories = [];
  const lower = text.toLowerCase();

  if (/meditation|mindfulness|breathing|zen/i.test(lower)) categories.push('meditation');
  if (/sleep|insomnia|rest|dream/i.test(lower)) categories.push('sleep');
  if (/stress|anxiety|calm|relax|tension/i.test(lower)) categories.push('stress-relief');
  if (/skincare|skin|face|beauty/i.test(lower)) categories.push('skincare');
  if (/nutrition|diet|food|healthy eating/i.test(lower)) categories.push('nutrition');
  if (/mental.?health|therapy|psychology/i.test(lower)) categories.push('mental-health');
  if (/routine|habit|ritual|daily/i.test(lower)) categories.push('routine');

  return categories.length > 0 ? categories : null;
};

const extractFocus = (text) => {
  const focus = [];
  const lower = text.toLowerCase();

  if (/mind|mental|brain|thoughts/i.test(lower)) focus.push('mind');
  if (/body|physical|movement|stretch/i.test(lower)) focus.push('body');
  if (/spirit|soul|energy|chakra/i.test(lower)) focus.push('spirit');
  if (/emotion|feeling|emotional/i.test(lower)) focus.push('emotional');

  return focus.length > 0 ? focus : null;
};

const extractDuration = (text) => {
  const match = text.match(/(\d+)\s*(?:minute|min|hour|hr)/i);
  return match ? `${match[1]} min` : null;
};

const extractDifficulty = (text) => {
  const lower = text.toLowerCase();

  if (/beginner|easy|simple|basics/i.test(lower)) return 'beginner';
  if (/intermediate|moderate/i.test(lower)) return 'intermediate';
  if (/advanced|deep|experienced/i.test(lower)) return 'advanced';

  return null;
};

const extractFrequency = (text) => {
  const lower = text.toLowerCase();

  if (/daily|every day|morning|evening/i.test(lower)) return 'daily';
  if (/weekly|week|few times/i.test(lower)) return 'weekly';
  if (/monthly|month/i.test(lower)) return 'monthly';
  if (/whenever|as needed|flexible/i.test(lower)) return 'flexible';

  return null;
};

const extractTimeOfDay = (text) => {
  const lower = text.toLowerCase();

  if (/morning|dawn|sunrise|early/i.test(lower)) return 'morning';
  if (/evening|night|sunset|late/i.test(lower)) return 'evening';
  if (/afternoon|day|midday/i.test(lower)) return 'afternoon';
  if (/before.?bed|bedtime|sleep/i.test(lower)) return 'before-bed';

  return null;
};

const extractBenefits = (text) => {
  const benefits = [];
  const lower = text.toLowerCase();

  if (/stress.?relief|calm|relax|peace/i.test(lower)) benefits.push('stress-relief');
  if (/focus|concentration|clarity|mental/i.test(lower)) benefits.push('focus');
  if (/sleep|rest|insomnia|quality sleep/i.test(lower)) benefits.push('sleep');
  if (/energy|vitality|boost/i.test(lower)) benefits.push('energy');
  if (/mood|happy|happiness|positive/i.test(lower)) benefits.push('mood');

  return benefits.length > 0 ? benefits : null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 9;

  if (/wellness|health|mindfulness|meditation|sleep|stress/i.test(text)) signals += 2;
  if (/benefit|help|improve|enhance/i.test(text)) signals += 1;
  if (/routine|daily|practice|habit/i.test(text)) signals += 1;
  if (/duration|minute|hour|time/i.test(text)) signals += 1;
  if (/beginner|easy|difficulty/i.test(text)) signals += 1;
  if (/morning|evening|night|day/i.test(text)) signals += 1;
  if (/calm|relax|peace|stress/i.test(text)) signals += 1;
  if (/guide|tutorial|how to/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractWellnessMetadata,
};
