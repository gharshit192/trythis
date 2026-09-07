// What we can honestly say we know about a user, from what they already did.
//
// Every signal here was already being collected and read by nothing
// (docs/MEMORY_ENGINE.md, G3/G11/G12): UserBehavior has a persister and no
// consumer, `rating`/`triedNote` have been gathered since ADR 0015 and feed
// nothing, and userPersona is recomputed on every notification run and thrown
// away. This turns all of it into one durable document per user.
//
// `rollupSignals` is pure — saves and behaviours in, numbers out — so the
// interesting part is testable without a database.

const CATEGORY_PERSONA = {
  travel: 'traveller', hotels: 'traveller',
  shopping: 'shopper', fashion: 'shopper',
  food: 'foodie', cafes: 'foodie', restaurants: 'foodie', recipes: 'foodie',
  experiences: 'explorer', experience: 'explorer', events: 'explorer', entertainment: 'explorer',
  fitness: 'health-focused', wellness: 'health-focused',
  tech: 'tech-curious', startups: 'tech-curious',
  finance: 'planner', productivity: 'planner',
  learning: 'learner',
};

// A save re-opened this many times, and still not tried, is the strongest
// unacted-on intent signal in the schema — and nothing has ever read it.
const REOPEN_THRESHOLD = 3;
const MIN_FOR_PERSONA = 5;
const RECENT_DAYS = 30;

const days = (from, to) => (new Date(to) - new Date(from)) / 86400000;

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const topN = (counts, n) => Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, n)
  .map(([key, count]) => ({ key, count }));

/**
 * @param {Array} saves     the user's active saves (lean docs)
 * @param {Array} behaviors UserBehavior rows, newest first or any order
 * @returns a plain signals object, safe to persist as-is
 */
function rollupSignals({ saves = [], behaviors = [], now = new Date() } = {}) {
  const recentCutoff = new Date(now.getTime() - RECENT_DAYS * 86400000);

  // ── categories, recency-weighted the way userPersona already does it ──
  const weighted = {};
  const plain = {};
  for (const s of saves) {
    const w = new Date(s.createdAt) >= recentCutoff ? 2 : 1;
    weighted[s.category] = (weighted[s.category] || 0) + w;
    plain[s.category] = (plain[s.category] || 0) + 1;
  }
  const totalWeight = Object.values(weighted).reduce((a, b) => a + b, 0);
  const rankedCats = topN(weighted, 3);
  const topShare = totalWeight ? (rankedCats[0]?.count || 0) / totalWeight : 0;

  let persona = { type: 'new_user', confidence: 0 };
  if (saves.length >= MIN_FOR_PERSONA) {
    persona = topShare < 0.4
      ? { type: 'multi-interest', confidence: 0.6 }
      : { type: CATEGORY_PERSONA[rankedCats[0].key] || 'general', confidence: Math.min(0.95, 0.5 + topShare) };
  } else if (saves.length) {
    persona = { type: 'just-started', confidence: 0.3 };
  }

  // ── places ──
  const cityCounts = {};
  for (const s of saves) {
    const city = s.extractedLocation?.city;
    if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
  }

  // ── lifecycle ──
  const tried = saves.filter((s) => s.intentStatus === 'tried');
  const planned = saves.filter((s) => s.intentStatus === 'planned');
  const rated = saves.filter((s) => typeof s.rating === 'number');
  const latencies = tried
    .filter((s) => s.triedAt && s.createdAt)
    .map((s) => days(s.createdAt, s.triedAt))
    .filter((d) => d >= 0 && d < 730);

  // ── re-opens: the untapped signal ──
  const viewsBySave = {};
  const hourHist = {};
  for (const b of behaviors) {
    if (b.type === 'view' && b.saveId) {
      const id = String(b.saveId);
      viewsBySave[id] = (viewsBySave[id] || 0) + 1;
    }
    const ts = b.timestamp || b.createdAt;
    if (ts) {
      const h = new Date(ts).getHours();
      hourHist[h] = (hourHist[h] || 0) + 1;
    }
  }
  const byId = new Map(saves.map((s) => [String(s._id), s]));
  const reopened = Object.entries(viewsBySave)
    .filter(([id, n]) => n >= REOPEN_THRESHOLD && byId.get(id) && byId.get(id).intentStatus !== 'tried')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, views]) => ({ saveId: id, title: byId.get(id).title, views }));

  return {
    saveCount: saves.length,
    triedCount: tried.length,
    plannedCount: planned.length,
    persona,
    topCategories: rankedCats.map((c) => ({ category: c.key, count: plain[c.key] || 0 })),
    cities: topN(cityCounts, 3).map((c) => ({ city: c.key, count: c.count })),
    reopened,
    ratings: {
      count: rated.length,
      average: rated.length ? Number((rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(2)) : null,
      loved: rated.filter((s) => s.rating >= 4).slice(0, 5).map((s) => s.title),
    },
    // How long this person actually takes to act. The right input for nudge
    // timing — far better than the current fixed schedule.
    daysToTry: { median: median(latencies), sample: latencies.length },
    activeHours: topN(hourHist, 2).map((h) => Number(h.key)),
    generatedAt: now,
  };
}

// Words, never numbers — the dashboard shows "usually", not 0.72.
const sureness = (c) => (c >= 0.85 ? 'always' : c >= 0.6 ? 'usually' : c >= 0.4 ? 'often' : 'I think');

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Signals → the sentences a person can actually read. This is "What I know
 * about you" v0, and the same shape the Memory layer's derived memories will
 * take (docs/MEMORY_ENGINE.md §8.4) — statement, detail, sureness, source.
 */
function statementsFrom(signals) {
  if (!signals || !signals.saveCount) return { gist: null, groups: [] };
  const g = [];

  const interests = [];
  for (const c of signals.topCategories) {
    interests.push({
      statement: `Saves a lot of ${c.category}`,
      detail: `${plural(c.count, 'save', 'saves')}`,
      sureness: sureness(Math.min(0.9, 0.4 + c.count / 20)),
      source: 'from your saves',
    });
  }
  if (interests.length) g.push({ title: 'Interests', items: interests });

  if (signals.cities.length) {
    g.push({
      title: 'Places',
      items: signals.cities.map((c) => ({
        statement: `Saves things in ${c.city}`,
        detail: plural(c.count, 'save', 'saves'),
        sureness: sureness(Math.min(0.9, 0.4 + c.count / 15)),
        source: 'from your saves',
      })),
    });
  }

  const habits = [];
  if (signals.daysToTry.median != null && signals.daysToTry.sample >= 3) {
    const d = Math.round(signals.daysToTry.median);
    habits.push({
      statement: d <= 3 ? 'Acts on a save within a few days' : `Gets to a save about ${d} days after saving it`,
      detail: `across ${plural(signals.daysToTry.sample, 'thing', 'things')} you tried`,
      sureness: sureness(0.6),
      source: 'from when you marked things tried',
    });
  }
  if (signals.activeHours.length) {
    const h = signals.activeHours[0];
    const when = h < 5 ? 'late at night' : h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 22 ? 'in the evening' : 'late at night';
    habits.push({
      statement: `Usually opens the app ${when}`,
      detail: null,
      sureness: sureness(0.5),
      source: 'from when you visit',
    });
  }
  if (habits.length) g.push({ title: 'Habits', items: habits });

  if (signals.reopened.length) {
    g.push({
      title: 'Keeps coming back to',
      items: signals.reopened.map((r) => ({
        statement: r.title,
        detail: `opened ${r.views} times, not tried yet`,
        sureness: 'always',
        source: 'from what you re-open',
        saveId: r.saveId,
      })),
    });
  }

  if (signals.ratings.loved.length) {
    g.push({
      title: 'Liked',
      items: signals.ratings.loved.map((t) => ({
        statement: t,
        detail: 'you rated this 4 or 5',
        sureness: 'always',
        source: 'from your rating',
      })),
    });
  }

  const cats = signals.topCategories.map((c) => c.category);
  const city = signals.cities[0]?.city;
  const gist = [
    city ? `You save most of your things in ${city}` : 'You’re still getting started',
    cats.length ? `mostly ${cats.slice(0, 2).join(' and ')}` : null,
    signals.triedCount ? `and you’ve actually done ${signals.triedCount} of them` : 'and haven’t tried any of them yet',
  ].filter(Boolean).join(', ').concat('.');

  return { gist, groups: g };
}

module.exports = { rollupSignals, statementsFrom, __test__: { median, sureness } };
