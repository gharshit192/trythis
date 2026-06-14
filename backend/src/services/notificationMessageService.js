// backend/src/services/notificationMessageService.js
// Generates unique, contextual notification messages with an LLM
// (Groq → Claude), falling back to curated templates if both are unavailable.

const Groq = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── FALLBACK TEMPLATES ──────────────────────────────────────────────────────
// Used when Groq is unavailable or rate limited
// Multiple per type for variety — picked randomly

const FALLBACK_TEMPLATES = {

  welcome: [
    { title: "Welcome to TryThis", body: "Save your first link and we'll organise it automatically. Cafes, trips, products — anything." },
    { title: "You're all set", body: "Paste any Instagram reel or YouTube link. We'll handle the rest." },
    { title: "TryThis is ready", body: "Save things you want to try. We'll remind you before you forget them." }
  ],

  shared_save_viewed: [
    { title: "Someone viewed your save", body: 'Your "{title}" save was just opened.' },
    { title: "{count} views on your save",  body: '"{title}" has been viewed {count} times since you shared it.' },
    { title: "Your share got attention",    body: 'Someone just opened your "{title}" save.' }
  ],

  resurface: [
    { title: "Still want to try this?",      body: 'You saved "{title}" {daysAgo} days ago. Still on your list?' },
    { title: "Remember this one?",           body: '"{title}" has been waiting {daysAgo} days. Worth revisiting?' },
    { title: "This one is still waiting",    body: 'You saved "{title}" a while back. Still planning to try it?' },
    { title: "Don't let this one slip",      body: '"{title}" — saved {daysAgo} days ago and still unvisited.' },
    { title: "Rediscover something you saved", body: '"{title}" is still in your list from {daysAgo} days ago.' },
    { title: "Pick up where you left off",   body: 'Your "{title}" save is {daysAgo} days old. Good time to revisit.' },
    { title: "You had great taste",          body: 'You saved "{title}" — {daysAgo} days later, still looks worth trying.' },
    { title: "This save is aging well",      body: '"{title}" — saved {daysAgo} days ago and still relevant.' },
    { title: "Your past self saved this",    body: '"{title}" has been waiting {daysAgo} days for you.' },
    { title: "Unfinished business",          body: 'You saved "{title}" {daysAgo} days ago. Still on the cards?' }
  ],

  weekend_reminder: [
    { title: "Weekend plans?",               body: 'You have {count} saves that would make a great weekend. "{title}" is one of them.' },
    { title: "It\'s {dayName}",              body: 'Good time to act on those saves. "{title}" has been waiting.' },
    { title: "Make this weekend count",      body: 'You saved "{title}" — {dayName} is a good day to finally try it.' },
    { title: "{count} saves, one weekend",   body: 'Pick one. "{title}" has been sitting in your list long enough.' },
    { title: "Your weekend, planned",        body: '"{title}" and {count} other saves are ready for this weekend.' },
    { title: "No more saving, time to go",   body: 'You have {count} unvisited saves. This weekend is calling.' }
  ],

  travel_goa: [
    { title: "Goa is calling",               body: 'You\'ve saved {count} Goa spots. When are you actually going?' },
    { title: "Your Goa list is growing",     body: '"{title}" is one of {count} Goa saves. Time to plan the trip.' },
    { title: "Goa in December?",             body: 'Peak season is coming. You saved "{title}" — worth booking now.' },
    { title: "Still dreaming about Goa?",    body: '{count} saves and counting. "{title}" is still unvisited.' },
    { title: "Goa saves, no Goa trip yet",   body: 'You have {count} Goa saves. The planning needs to start somewhere.' }
  ],

  travel_kerala: [
    { title: "Kerala is waiting",            body: 'You saved "{title}" and {count} other Kerala spots. When are you going?' },
    { title: "Your Kerala list is ready",    body: '{count} saves, one destination. "{title}" made the list — time to act on it.' },
    { title: "Monsoon magic in Kerala",      body: 'You saved "{title}". Kerala monsoon season is something else.' },
    { title: "Plan that Kerala trip",        body: '"{title}" has been in your saves. Kerala does not disappoint.' },
    { title: "Onam is coming",               body: 'You saved Kerala content. Onam season is the best time to visit.' }
  ],

  travel_himachal: [
    { title: "The mountains are calling",    body: 'You saved "{title}". Himachal in {season} is worth the trip.' },
    { title: "Your Himachal saves",          body: '{count} mountain saves and no trip planned yet. "{title}" is a good start.' },
    { title: "Escape to the hills",          body: 'You saved "{title}". A Himachal weekend could fix everything.' },
    { title: "Snow season is coming",        body: 'You saved {count} Himachal spots. December onwards is prime time.' }
  ],

  travel_rajasthan: [
    { title: "Rajasthan in winter",          body: 'Best time to visit is Oct–Feb. You saved "{title}" — perfect timing.' },
    { title: "Your Rajasthan saves",         body: '{count} saves from Rajasthan. "{title}" looks like the highlight.' },
    { title: "Forts, dunes, camels",         body: 'You saved "{title}". Rajasthan in winter is hard to beat.' }
  ],

  travel_generic: [
    { title: "Trip planning time?",          body: 'You\'ve been saving {destination} content. {count} saves, zero trips planned.' },
    { title: "Your {destination} saves",     body: '"{title}" and {count} others from {destination} are still waiting.' },
    { title: "{destination} is on your list",body: 'You saved {count} spots there. When is the trip happening?' },
    { title: "Time to act on this",          body: 'You saved "{title}" from {destination}. It\'s been {daysAgo} days.' }
  ],

  flight_price_drop: [
    { title: "Flights to {destination} dropped", body: 'Down to ₹{price}. You have {count} {destination} saves — good time to book.' },
    { title: "₹{price} to {destination}",    body: 'Prices are lower than usual. You saved "{title}" — still interested?' },
    { title: "{destination} fares just fell",body: '₹{price} right now. Your "{title}" save has been waiting {daysAgo} days.' },
    { title: "Cheap flights to {destination}",body: '₹{price} round trip. You\'ve saved {count} spots there — worth a look.' }
  ],

  hotel_discount: [
    { title: "Hotels in {destination} at {discount}% off", body: 'From ₹{price}/night this weekend. You saved "{title}" — still on the list?' },
    { title: "{discount}% off in {destination}", body: 'Stays from ₹{price}/night. Your {destination} saves are ready.' },
    { title: "{destination} just got affordable", body: '{discount}% off hotels. You saved {count} spots there — good timing.' }
  ],

  cultural_event: [
    { title: "{eventName} is happening",     body: 'You saved {destination} content. {eventName} starts {date} — worth planning around.' },
    { title: "Event in {destination}",       body: '{eventName} on {date}. You have {count} {destination} saves — this fits perfectly.' },
    { title: "Don\'t miss {eventName}",      body: 'You saved "{title}" from {destination}. {eventName} starts {date}.' }
  ],

  weather_good: [
    { title: "Perfect weather in {destination}", body: '{temp}°C and clear skies this weekend. You saved "{title}" there.' },
    { title: "{destination} weather looks great",body: 'Clear skies, {temp}°C. Your {destination} saves have been waiting for this.' },
    { title: "Good weekend for {destination}",   body: 'Weather is ideal. You saved {count} {destination} spots — pick one.' }
  ],

  nearby: [
    { title: "You\'re near a saved place",   body: '"{title}" is {distance}m away. You saved it {daysAgo} days ago.' },
    { title: "{title} is right here",        body: 'You saved this {daysAgo} days ago. You\'re only {distance}m away right now.' },
    { title: "Saved place nearby",           body: '"{title}" is {distance}m from where you are. Good time to finally try it.' },
    { title: "Your save is around the corner", body: '{distance}m to "{title}". You saved this {daysAgo} days ago.' }
  ],

  food_nearby: [
    { title: "That cafe you saved is close", body: '"{title}" is {distance}m away. You saved it {daysAgo} days ago — hungry?' },
    { title: "{title} is nearby",            body: '{distance}m from here. You\'ve been saving it for {daysAgo} days.' },
    { title: "Lunchtime near a saved cafe",  body: '"{title}" is {distance}m away. You saved this — finally worth trying?' }
  ],

  shopping_deal: [
    { title: "Price drop on something you saved", body: '"{title}" dropped by {discount}%. You saved this {daysAgo} days ago.' },
    { title: "{title} is on sale",           body: '{discount}% off. You\'ve had this saved for {daysAgo} days — good time.' },
    { title: "Deal on your saved item",      body: 'You saved "{title}" — it\'s {discount}% off right now.' }
  ]
};

// ── VARIABLE INJECTION ───────────────────────────────────────────────────────
const inject = (template, vars = {}) => {
  let text = template;
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '');
  }
  return text;
};

// Pick a random template from a type
const pickTemplate = (type, vars = {}) => {
  const templates = FALLBACK_TEMPLATES[type] || FALLBACK_TEMPLATES.resurface;
  const template  = templates[Math.floor(Math.random() * templates.length)];
  return {
    title: inject(template.title, vars),
    body:  inject(template.body,  vars)
  };
};

// ── LLM PROMPT ────────────────────────────────────────────────────────────────
const buildLLMPrompt = ({ type, saveTitle, destination, vars = {}, recentBodies = [] }) => {
  const contextMap = {
    resurface:        `Remind user about a save they forgot. Save: "${saveTitle}". Saved ${vars.daysAgo || '?'} days ago.`,
    weekend_reminder: `It's the weekend. User has ${vars.count || 'several'} unvisited saves. Featured save: "${saveTitle}"${vars.category ? ` (${vars.category})` : ''}${destination && destination !== 'nearby' ? ` in ${destination}` : ''}.`,
    flight_price_drop:`Flights to ${destination} dropped to ₹${vars.price || '?'}. User has ${vars.count || 1} ${destination} saves.`,
    hotel_discount:   `Hotels in ${destination} at ${vars.discount || '?'}% off, from ₹${vars.price || '?'}/night.`,
    cultural_event:   `${vars.eventName || 'An event'} in ${destination} on ${vars.date || 'soon'}. User saved ${destination} content.`,
    weather_good:     `Great weather in ${destination} — ${vars.temp || '?'}°C, clear. User has ${destination} saves.`,
    nearby:           `User is ${vars.distance || '?'}m from "${saveTitle}" which they saved ${vars.daysAgo || '?'} days ago.`,
    travel_goa:       `User has ${vars.count || 1} Goa saves. Featured: "${saveTitle}".`,
    travel_kerala:    `User has ${vars.count || 1} Kerala saves. Featured: "${saveTitle}".`,
    travel_himachal:  `User has ${vars.count || 1} Himachal saves. Featured: "${saveTitle}".`,
    travel_generic:   `User has ${vars.count || 1} ${destination} saves. Featured: "${saveTitle}".`,
  };
  const context = contextMap[type] || `Context: "${saveTitle}" saved by user.`;
  const avoidText = recentBodies?.length
    ? `\n\nDo NOT reuse phrasing similar to:\n${recentBodies.slice(0, 4).map((b, i) => `${i + 1}. "${b}"`).join('\n')}`
    : '';

  return `You write short notification messages for Wanna Try, a save-and-rediscover app.

${context}

Write a notification body (2 sentences max, 30 words max total).
Rules:
- Sound like a smart friend texting, not marketing copy
- Reference the specific save by name and why it's relevant right now
- End with a gentle nudge or question
- Warm and conversational tone
- No hashtags, no emoji
- At most one exclamation mark
${avoidText}

Return ONLY the notification body text. No quotes. No explanation.`;
};

const isUsableBody = (text) => !!text && text.length > 10 && text.length < 180;

// ── LLM GENERATION (Groq → Claude) ───────────────────────────────────────────
const generateWithGroq = async (args) => {
  if (!groq) return null;
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 70,
      temperature: 0.85,
      messages: [{ role: 'user', content: buildLLMPrompt(args) }],
    });
    const text = response.choices[0]?.message?.content?.trim();
    return isUsableBody(text) ? text : null;
  } catch (err) {
    logger.warn(`[notificationMessageService] Groq failed: ${err.message}`);
    return null;
  }
};

const generateWithClaude = async (args) => {
  if (!anthropic) return null;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 90,
      messages: [{ role: 'user', content: buildLLMPrompt(args) }],
    });
    const text = msg?.content?.[0]?.text?.trim().replace(/^["']|["']$/g, '');
    return isUsableBody(text) ? text : null;
  } catch (err) {
    logger.warn(`[notificationMessageService] Claude failed: ${err.message}`);
    return null;
  }
};

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
const getMessage = async ({ type, saveTitle, destination, vars = {}, userId }) => {
  // Get recent notification bodies to avoid repetition
  let recentBodies = [];
  if (userId) {
    try {
      const Notification = require('../models/Notification');
      const recent = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('body');
      recentBodies = recent.map(n => n.body).filter(Boolean);
    } catch {}
  }

  // Smart body: Groq (free/fast) → Claude (reliable) → curated template.
  const args = { type, saveTitle, destination, vars, recentBodies };
  const body = await generateWithGroq(args) || await generateWithClaude(args);

  if (body) {
    // Title still comes from the curated template; the LLM writes the body.
    const tpl = pickTemplate(type, vars);
    return { title: tpl.title, body };
  }

  logger.info(`[notificationMessageService] using template fallback for type=${type}`);
  return pickTemplate(type, vars);
};

module.exports = { getMessage, pickTemplate, inject };
