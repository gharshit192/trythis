import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import SectionLabel from '../../components/SectionLabel';

// Experience DNA (mobile PRD §44) — what we have worked out about your taste.
//
// The two rules §44 sets are both visible on this screen rather than buried in
// the engine: a trait only appears once there is enough behind it, and every
// trait says whether you told us or we noticed. An inference is never dressed up
// as something you said.

const BAR = { stated: 'var(--brand)', mixed: 'var(--brand)', observed: 'var(--gold, #C99425)' };

// Said plainly. "Strong / Some / Rarely" is the engine's word for the level;
// this is the sentence under the bar that explains where it came from.
function evidenceLine({ basis, because }) {
  const bits = [];
  if (because.said) bits.push(`you said this${because.said > 1 ? ` ${because.said} times` : ''}`);
  if (because.saved) bits.push(`${because.saved} save${because.saved === 1 ? '' : 's'}`);
  if (because.tried) bits.push(`${because.tried} tried`);
  if (because.disliked) bits.push(`${because.disliked} you did not like`);
  const lead = basis === 'stated' ? 'You told me' : basis === 'mixed' ? 'You said this, and it shows' : 'We noticed this';
  return bits.length ? `${lead} · ${bits.join(', ')}` : lead;
}

export default function ExperienceDNA({ onBack, onNavigate }) {
  const [dna, setDna] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.getDna()
      .then((r) => (r?.status === 'success' ? setDna(r.data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const header = (
    <div className="df-ai gap-s" style={{ marginBottom: 18 }}>
      <button onClick={onBack} className="wt-icon-btn" aria-label="Back"><Icon name="back" size={22} /></button>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Your taste</span>
    </div>
  );

  if (failed) {
    return (
      <div className="wt-screen">
        {header}
        <p style={{ color: 'var(--mute)' }}>We could not work that out right now. Try again in a moment.</p>
      </div>
    );
  }

  if (!dna) return <div className="wt-screen">{header}</div>;

  // §44: "Only display after enough evidence." Nothing is better than a guess.
  if (!dna.ready) {
    return (
      <div className="wt-screen">
        {header}
        <h1 className="wt-title" style={{ fontSize: 28, marginBottom: 8 }}>Not yet — keep saving</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--mute)', marginBottom: 18 }}>
          We would rather say nothing than guess. A few more saves, or one thing you
          try and rate, and this fills in.
        </p>
        {dna.notEnough?.length > 0 && (
          <div className="wt-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Starting to see</div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>{dna.notEnough.join(' · ')}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wt-screen">
      {header}
      <h1 className="wt-title" style={{ fontSize: 28, marginBottom: 6 }}>What we&rsquo;ve worked out</h1>
      <p style={{ fontSize: 13.5, color: 'var(--mute)', marginBottom: 20 }}>
        From {dna.counts.saves} saves and {dna.counts.tried} things you tried.
      </p>

      <div className="dfc gap-md" style={{ marginBottom: 18 }}>
        {dna.traits.map((t) => (
          <div key={t.subject} className="dfc" style={{ gap: 5 }}>
            <div className="df-ai-jcs" style={{ alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: BAR[t.basis] }}>{t.level}</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'var(--line, #EDE8E0)' }}>
              <div style={{
                height: 7, borderRadius: 4, width: `${Math.round(t.strength * 100)}%`,
                background: BAR[t.basis], transition: 'width .3s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>{evidenceLine(t)}</span>
          </div>
        ))}
      </div>

      {dna.notEnough?.length > 0 && (
        <div className="wt-card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="df gap-s" style={{ alignItems: 'flex-start' }}>
            <Icon name="eye" size={17} style={{ color: 'var(--mute)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
                Not enough yet: {dna.notEnough.join(', ')}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--mute)' }}>
                We&rsquo;d rather say nothing than guess. These show up once there&rsquo;s real evidence.
              </div>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 18 }}>
        Based on the last {dna.windowDays} days. Older saves count for less.
      </p>

      <SectionLabel>Ask about your taste</SectionLabel>
      <div className="dfc gap-s" style={{ marginTop: 8 }}>
        {["What haven't I tried yet?", 'What did I love most this year?'].map((q) => (
          <button key={q} className="wt-card" onClick={() => onNavigate?.('ask', { question: q })}
            style={{ padding: '10px 13px', textAlign: 'left', fontSize: 13.5, cursor: 'pointer' }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
