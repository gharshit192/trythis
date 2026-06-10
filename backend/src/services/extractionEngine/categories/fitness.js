const extractFitnessMetadata = (content) => {
  const text = `${content.title || ''} ${content.description || ''}`;

  return {
    primary_category: 'fitness',

    // Fitness-specific fields
    workoutType: extractWorkoutType(text),
    difficulty: extractDifficulty(text),
    duration: extractDuration(text),

    // Equipment
    equipment: extractEquipment(text),
    locationRequired: extractLocationRequired(text),

    // Fitness goals
    targetArea: extractTargetArea(text),
    fitnessGoal: extractFitnessGoal(text),

    // Engagement
    intensity: extractIntensity(text),
    isPopular: /trending|viral|popular|challenge/i.test(text),

    confidence: calculateConfidence(text),
  };
};

const extractWorkoutType = (text) => {
  const types = [];
  const lower = text.toLowerCase();

  if (/yoga|flexibility|stretching/i.test(lower)) types.push('yoga');
  if (/running|jogging|cardio|hiit/i.test(lower)) types.push('cardio');
  if (/weight|strength|lifting|powerlifting/i.test(lower)) types.push('strength');
  if (/pilates|core/i.test(lower)) types.push('pilates');
  if (/dance|zumba|movement/i.test(lower)) types.push('dance');
  if (/sports|basketball|soccer|tennis/i.test(lower)) types.push('sports');
  if (/cycling|bike/i.test(lower)) types.push('cycling');
  if (/swimming|water/i.test(lower)) types.push('swimming');

  return types.length > 0 ? types : null;
};

const extractDifficulty = (text) => {
  const lower = text.toLowerCase();

  if (/beginner|easy|basics/i.test(lower)) return 'beginner';
  if (/intermediate|intermediate|moderate/i.test(lower)) return 'intermediate';
  if (/advanced|hard|expert|challenging/i.test(lower)) return 'advanced';

  return null;
};

const extractDuration = (text) => {
  const match = text.match(/(\d+)\s*(?:minute|min|hour|hr)/i);
  return match ? `${match[1]} min` : null;
};

const extractEquipment = (text) => {
  const equipment = [];
  const lower = text.toLowerCase();

  if (/dumbbells|weights|barbell/i.test(lower)) equipment.push('weights');
  if (/mat|yoga mat/i.test(lower)) equipment.push('mat');
  if (/resistance|band|loop/i.test(lower)) equipment.push('resistance-bands');
  if (/kettlebell/i.test(lower)) equipment.push('kettlebell');
  if (/no equipment|bodyweight|at home/i.test(lower)) equipment.push('none');

  return equipment.length > 0 ? equipment : null;
};

const extractLocationRequired = (text) => {
  const lower = text.toLowerCase();

  if (/gym|studio|facility|class/i.test(lower)) return 'gym';
  if (/home|at home|apartment/i.test(lower)) return 'home';
  if (/outdoor|park|nature|trail/i.test(lower)) return 'outdoor';

  return null;
};

const extractTargetArea = (text) => {
  const areas = [];
  const lower = text.toLowerCase();

  if (/abs|core|stomach/i.test(lower)) areas.push('abs');
  if (/legs|quads|glutes|butt/i.test(lower)) areas.push('legs');
  if (/arms|biceps|triceps/i.test(lower)) areas.push('arms');
  if (/back|lats|shoulders/i.test(lower)) areas.push('back');
  if (/chest|pecs/i.test(lower)) areas.push('chest');
  if (/full.?body|total body/i.test(lower)) areas.push('full-body');

  return areas.length > 0 ? areas : null;
};

const extractFitnessGoal = (text) => {
  const goals = [];
  const lower = text.toLowerCase();

  if (/weight.?loss|lose weight|fat burn/i.test(lower)) goals.push('weight-loss');
  if (/muscle|gain|strength|build/i.test(lower)) goals.push('muscle-gain');
  if (/endurance|stamina|cardio/i.test(lower)) goals.push('endurance');
  if (/flexibility|mobility|yoga/i.test(lower)) goals.push('flexibility');
  if (/tone|definition|shape/i.test(lower)) goals.push('toning');

  return goals.length > 0 ? goals : null;
};

const extractIntensity = (text) => {
  const lower = text.toLowerCase();

  if (/high.?intensity|hiit|intense|extreme/i.test(lower)) return 'high';
  if (/moderate|medium|balanced/i.test(lower)) return 'moderate';
  if (/low.?intensity|gentle|easy|relaxing/i.test(lower)) return 'low';

  return null;
};

const calculateConfidence = (text) => {
  let signals = 0;
  const maxSignals = 9;

  if (/workout|exercise|fitness|gym|training/i.test(text)) signals += 2;
  if (/duration|minute|hour|time/i.test(text)) signals += 1;
  if (/difficulty|level|beginner|advanced/i.test(text)) signals += 1;
  if (/equipment|weights|mat/i.test(text)) signals += 1;
  if (/goal|gain|lose|strength/i.test(text)) signals += 1;
  if (/cardio|strength|yoga|pilates/i.test(text)) signals += 1;
  if (/calories|burn|abs|legs|arms/i.test(text)) signals += 1;
  if (/trending|popular|challenge/i.test(text)) signals += 1;

  return Math.min(signals / maxSignals, 1);
};

module.exports = {
  extractFitnessMetadata,
};
