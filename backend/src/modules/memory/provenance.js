// Technical PRD §52: explicit and inferred preferences must stay distinguishable
// internally. `evidence.kind` records the channel a memory arrived through, which
// is not the same question — a rating and a spoken sentence are both "voice-era"
// signals but only one is the user telling us something.
//
//   stated   — the user said it. Their words, quotable back to them.
//   observed — we worked it out from what they did.
//
// This matters at the surface too: Experience DNA (mobile PRD §44) has to say
// which kind of evidence a trait stands on, and must not present the second as
// the first.
const STATED = ['explicit', 'ask_turn', 'voice', 'correction'];
const OBSERVED = ['rating', 'save'];

const provenanceOf = (kind) => (STATED.includes(kind) ? 'stated' : 'observed');

/** 'stated' | 'observed' | 'mixed' | null — what a memory as a whole rests on. */
function basisOf(evidence = []) {
  if (!evidence.length) return null;
  const kinds = new Set(evidence.map((e) => e.provenance || provenanceOf(e.kind)));
  if (kinds.size > 1) return 'mixed';
  return [...kinds][0];
}

module.exports = { provenanceOf, basisOf, STATED, OBSERVED };
