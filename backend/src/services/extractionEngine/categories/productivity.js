const extractProductivityMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'productivity',

    // Productivity-specific fields
    toolType: extractToolType(text),
    category: extractCategory(text),
    setupComplexity: extractSetupComplexity(text),

    // Compatibility
    platforms: extractPlatforms(text),
    integrations: extractIntegrations(text),

    // Effectiveness
    useCase: extractUseCase(text),
    timeToMastery: extractTimeToMastery(text),

    // Signals
    isPopular: /trending|popular|widely used|favorite/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractToolType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/notion|obsidian|notion template|database/i.test(lower)) types.push('knowledge-management');
  if (/todoist|task|reminder|todo|checklist/i.test(lower)) types.push('task-management');
  if (/calendar|schedule|time block|planner/i.test(lower)) types.push('calendar');
  if (/automation|zapier|workflow|trigger/i.test(lower)) types.push('automation');
  if (/note|notes|notetaking|writing/i.test(lower)) types.push('note-taking');
  if (/focus|pomodoro|timer|distraction/i.test(lower)) types.push('focus');

  return types.length > 0 ? types : null;
};

const extractCategory = (text) => {
  const categories = [];
  const lower = text.toLowerCase();

  if (/system|gtd|getting things done|workflow/i.test(lower)) categories.push('system');
  if (/hack|hack|optimization|efficiency/i.test(lower)) categories.push('hack');
  if (/template|framework|structure/i.test(lower)) categories.push('template');

  return categories.length > 0 ? categories : null;
};

const extractSetupComplexity = (text) => {
  const lower = text.toLowerCase();

  if (/simple|easy|quick|fast|minimal setup/i.test(lower)) return 'simple';
  if (/moderate|moderate setup|requires setup/i.test(lower)) return 'moderate';
  if (/complex|advanced|intricate|detailed setup/i.test(lower)) return 'complex';

  return null;
};

const extractPlatforms = (text) => {
  const platforms = [];
  const lower = text.toLowerCase();

  if (/web|browser|online/i.test(lower)) platforms.push('web');
  if (/ios|iphone|ipad|apple/i.test(lower)) platforms.push('ios');
  if (/android/i.test(lower)) platforms.push('android');
  if (/windows|win/i.test(lower)) platforms.push('windows');
  if (/mac|macos/i.test(lower)) platforms.push('macos');

  return platforms.length > 0 ? platforms : null;
};

const extractIntegrations = (text) => {
  const integrations = [];
  const lower = text.toLowerCase();

  if (/slack|discord/i.test(lower)) integrations.push('chat');
  if (/google|gsheet|calendar/i.test(lower)) integrations.push('google');
  if (/outlook|microsoft|office/i.test(lower)) integrations.push('microsoft');
  if (/zapier|automation/i.test(lower)) integrations.push('zapier');
  if (/notion|obsidian|logseq/i.test(lower)) integrations.push('knowledge-base');

  return integrations.length > 0 ? integrations : null;
};

const extractUseCase = (text) => {
  const usecases = [];
  const lower = text.toLowerCase();

  if (/work|professional|business|career/i.test(lower)) usecases.push('work');
  if (/personal|life|organization|goals/i.test(lower)) usecases.push('personal');
  if (/team|collaboration|group|project/i.test(lower)) usecases.push('collaboration');
  if (/student|study|learning|school/i.test(lower)) usecases.push('student');

  return usecases.length > 0 ? usecases : null;
};

const extractTimeToMastery = (text) => {
  const lower = text.toLowerCase();

  if (/quick|fast|easy|minutes|hours/i.test(lower)) return 'quick';
  if (/days|week|moderate/i.test(lower)) return 'moderate';
  if (/weeks|months|complex/i.test(lower)) return 'long';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 9;

  if (/productivity|tool|automation|workflow|productivity|efficiency/i.test(text)) signals += 2;
  if (/setup|implement|integration|configure/i.test(text)) signals += 1;
  if (/platform|web|app|desktop/i.test(text)) signals += 1;
  if (/usecase|benefit|help|solution/i.test(text)) signals += 1;
  if (/simple|easy|complex|difficulty/i.test(text)) signals += 1;
  if (/system|hack|tip|trick/i.test(text)) signals += 1;
  if (/notion|todoist|zapier|calendar/i.test(text)) signals += 1;
  if (/template|framework|guide/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractProductivityMetadata,
};
