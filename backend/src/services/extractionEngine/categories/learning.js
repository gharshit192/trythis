const { parseDifficulty, parseDuration } = require('../utils/parsers');

const extractLearningMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'learning',
    difficulty: parseDifficulty(text),
    duration: parseDuration(text),

    // Learning-specific fields
    skillCategory: extractSkillCategory(text),
    contentType: extractContentType(text),
    creator: extractCreator(text),

    // Learning attributes
    prerequisites: extractPrerequisites(text),
    learningPath: extractLearningPath(text),
    tools: extractToolsRequired(text),

    // Engagement signals
    isFree: /free|no cost|complimentary|no charge/i.test(text),
    hasCertificate: /certificate|certification|badge|credential/i.test(text),
    isProject: /project|build|create|hands-on|practical/i.test(text),

    // Quality signals
    creatorCredibility: extractCreatorCredibility(text),
    isPopular: /trending|popular|highly rated|bestseller|most enrolled/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractSkillCategory = (text) => {
  const categories = {
    'coding': ['programming', 'code', 'javascript', 'python', 'react', 'nodejs', 'web dev', 'backend', 'frontend'],
    'ai': ['ai', 'machine learning', 'ml', 'deep learning', 'neural network', 'llm', 'gpt', 'openai'],
    'business': ['business', 'startup', 'entrepreneurship', 'marketing', 'sales', 'strategy'],
    'design': ['design', 'ui', 'ux', 'figma', 'graphic', 'product design', 'visual'],
    'productivity': ['productivity', 'time management', 'system', 'workflow', 'automation', 'tool'],
    'career': ['career', 'resume', 'interview', 'job', 'negotiation', 'professional'],
    'finance': ['finance', 'investing', 'stock', 'crypto', 'money', 'trading', 'economics'],
    'language': ['language', 'english', 'spanish', 'french', 'german', 'learning'],
    'communication': ['communication', 'speaking', 'writing', 'presentation', 'public speaking'],
  };

  const lower = text.toLowerCase();
  const matches = [];

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) {
      matches.push(category);
    }
  }

  return matches.length > 0 ? matches : null;
};

const extractContentType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/course|class|lesson|tutorial/i.test(lower)) types.push('course');
  if (/video|youtube|vimeo/i.test(lower)) types.push('video');
  if (/article|blog|read|post/i.test(lower)) types.push('article');
  if (/book|ebook|reading/i.test(lower)) types.push('book');
  if (/podcast|audio|listen/i.test(lower)) types.push('podcast');
  if (/workshop|webinar|live/i.test(lower)) types.push('workshop');
  if (/project|build|create|hands-on/i.test(lower)) types.push('project');
  if (/documentation|guide|reference/i.test(lower)) types.push('documentation');

  return types.length > 0 ? types : null;
};

const extractCreator = (text) => {
  const patterns = [
    /(?:by|from|creator|author)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /(?:instructor|teacher|coach)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
};

const extractPrerequisites = (text) => {
  const prereqs = [];
  const lower = text.toLowerCase();

  if (/no experience|beginner friendly|no prerequisite/i.test(lower)) {
    return ['none'];
  }

  if (/basic javascript|js basics|javascript fundamentals/i.test(lower)) prereqs.push('JavaScript basics');
  if (/html\s*(?:\/|and)\s*css|html.*css/i.test(lower)) prereqs.push('HTML/CSS');
  if (/python basics|python fundamentals/i.test(lower)) prereqs.push('Python basics');
  if (/requires knowledge/i.test(lower)) prereqs.push('Prior knowledge required');
  if (/intermediate level/i.test(lower)) prereqs.push('Intermediate level knowledge');

  return prereqs.length > 0 ? prereqs : null;
};

const extractLearningPath = (text) => {
  const lower = text.toLowerCase();

  if (/roadmap|learning path|curriculum|structured|sequence/i.test(lower)) {
    return 'structured';
  }
  if (/self-paced|at your own pace|flexible/i.test(lower)) {
    return 'self-paced';
  }
  if (/project-based|build along|hands-on/i.test(lower)) {
    return 'project-based';
  }

  return null;
};

const extractToolsRequired = (text) => {
  const tools = [];
  const lower = text.toLowerCase();

  const toolsList = [
    'vs code', 'code editor', 'github', 'git', 'npm', 'nodejs', 'python', 'jupyter',
    'figma', 'photoshop', 'adobe', 'excel', 'sheets', 'notion', 'postman'
  ];

  for (const tool of toolsList) {
    if (lower.includes(tool)) {
      tools.push(tool);
    }
  }

  return tools.length > 0 ? tools : null;
};

const extractCreatorCredibility = (text) => {
  const lower = text.toLowerCase();

  if (/expert|recognized|award|published|phd|professor|industry leader/i.test(lower)) return 'expert';
  if (/experienced|professional|years of experience|seasoned/i.test(lower)) return 'experienced';
  if (/creator|instructor|teacher|mentor/i.test(lower)) return 'instructor';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 10;

  if (/learn|course|tutorial|educational|training/i.test(text)) signals += 2;
  if (/skill|knowledge|technique|method/i.test(text)) signals += 1;
  if (/difficulty|level|beginner|intermediate|advanced/i.test(text)) signals += 1;
  if (/duration|time|hours|minutes|days/i.test(text)) signals += 1;
  if (/project|build|create|practical|hands-on/i.test(text)) signals += 1;
  if (/certificate|credential|badge|completion/i.test(text)) signals += 1;
  if (/instructor|teacher|creator|author/i.test(text)) signals += 1;
  if (/prerequisite|requirement|knowledge/i.test(text)) signals += 1;
  if (/tool|software|language|framework/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractLearningMetadata,
};
