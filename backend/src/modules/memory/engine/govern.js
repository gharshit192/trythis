// What may become a memory at all (docs/MEMORY_ENGINE.md §3 step 2, §8.5).
//
// This runs before anything is written, because the surfacing tier is a
// property of the memory, not a prompt instruction at read time. A fact we
// never stored cannot leak, cannot be retrieved by mistake, and cannot be
// exposed by a future feature nobody has written yet.
//
// The load-bearing distinction is stated vs inferred. "I'm diabetic, keep it
// low sugar" is the user telling us a constraint and expecting us to use it.
// Concluding someone is diabetic because they saved three sugar-free recipes
// is surveillance dressed as personalisation — and frequently wrong.

// No product use case, at any confidence, from any source. We do not want to
// be the app that has a row about this.
const NEVER = [
  { domain: 'sexuality', re: /\b(gay|lesbian|bisexual|queer|straight|homosexual|sexual orientation|sexuality)\b/i },
  { domain: 'politics', re: /\b(votes?|voted|voting|political|politics|right[- ]wing|left[- ]wing|liberal|conservative|bjp|congress party|communist)\b/i },
  { domain: 'criminal', re: /\b(arrest|convict|criminal record|jail|prison|police case|fir\b|lawsuit against)/i },
  { domain: 'immigration', re: /\b(visa status|undocumented|illegal immigrant|asylum|deport|green card|citizenship status)/i },
];

// Real to the user and useful when they say it; an intrusion when we guess it.
const SENSITIVE = [
  { domain: 'health', re: /\b(diabet|cancer|asthma|epilep|thyroid|cholesterol|blood pressure|hypertens|disease|illness|disorder|diagnos|surgery|hospitali[sz]|chronic|disabilit|hiv|medication|prescri|allerg)/i },
  // Adjective forms matter as much as clinical ones: an extractor writes
  // "Seems anxious lately", not "Has anxiety".
  { domain: 'mental-health', re: /\b(depress|anxiet|anxious|bipolar|adhd|autis|therapy|therapist|psychiatr|panic attack|mental health|burn ?out|suicid|lonel|insomnia)/i },
  { domain: 'pregnancy', re: /\b(pregnan|expecting a baby|trying to conceive|ivf|miscarr|fertility)/i },
  { domain: 'religion', re: /\b(muslim|hindu by faith|christian|sikh|jain|buddhist|jewish|atheist|religious|faith|caste|brahmin|dalit)\b/i },
  { domain: 'finance', re: /\b(salary|income|in debt|loan|emi|bankrupt|credit score|net worth|can'?t afford|broke)\b/i },
];

const hit = (list, text) => list.find((d) => d.re.test(text));

// A memory has to be about something. These are the shapes an extractor
// produces when it had nothing to work with.
const TOO_VAGUE = /^(likes? (things|stuff|it)|is (a )?(person|user|someone)|enjoys life|has preferences?)\b/i;

const MIN_STATEMENT = 6;
const MAX_STATEMENT = 140;

/**
 * Decide whether a candidate assertion may be stored, and on what terms.
 *
 * @param {object} candidate  { statement, subject, kind, value, derived, importance, confidence }
 * @returns {{ok: true, candidate: object} | {ok: false, reason: string, domain?: string}}
 */
function govern(candidate = {}) {
  const statement = String(candidate.statement || '').trim();
  const subject = String(candidate.subject || '').trim();

  if (!statement || statement.length < MIN_STATEMENT) return { ok: false, reason: 'empty' };
  if (statement.length > MAX_STATEMENT) return { ok: false, reason: 'too-long' };
  if (!subject) return { ok: false, reason: 'no-subject' };
  if (TOO_VAGUE.test(statement)) return { ok: false, reason: 'too-vague' };
  // Nothing is stored without the user's own words behind it.
  if (!candidate.quote || String(candidate.quote).trim().length < 3) return { ok: false, reason: 'no-evidence' };

  const haystack = `${statement} ${subject}`;

  const never = hit(NEVER, haystack);
  if (never) return { ok: false, reason: 'never-store', domain: never.domain };

  const sensitive = hit(SENSITIVE, haystack);
  if (sensitive) {
    // Inferred from behaviour: drop. We are not entitled to this conclusion.
    if (candidate.derived) return { ok: false, reason: 'sensitive-inference', domain: sensitive.domain };
    // Said out loud: keep it, but it never gets volunteered unprompted and it
    // takes an explicit statement — never an inference — to change it later.
    return {
      ok: true,
      candidate: {
        ...candidate,
        statement,
        subject,
        sensitivity: 'sensitive',
        surfacing: 'confirm',
        importance: Math.max(candidate.importance ?? 0.5, 0.85),
      },
    };
  }

  // A single saved reel is not a preference (docs/MEMORY_ENGINE.md §3).
  if (candidate.derived && (candidate.observations ?? 0) < 5) {
    return { ok: false, reason: 'single-save-inference' };
  }

  return {
    ok: true,
    candidate: {
      ...candidate,
      statement,
      subject,
      sensitivity: candidate.sensitivity || 'personal',
      surfacing: candidate.surfacing || (candidate.derived ? 'relevant' : defaultSurfacing(subject)),
    },
  };
}

// The handful of things that make every answer better and that nobody wants
// announced back to them ("since you're vegetarian…" on every single reply).
const SILENT_SUBJECTS = /^(food\.diet|location\.city|language|travel\.accommodation\.budget|schedule\.nudge)/i;
const defaultSurfacing = (subject) => (SILENT_SUBJECTS.test(subject) ? 'silent' : 'relevant');

module.exports = { govern, __test__: { NEVER, SENSITIVE, defaultSurfacing } };
