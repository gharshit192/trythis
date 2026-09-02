import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import CategoryTile from '../../components/CategoryTile';
import { getCategoryTile } from '../../lib/categoryMeta';
import { Progress } from './OnboardingCity';

// Immediate value after onboarding (brief §8): ten-odd real places in the
// user's city, each with a reason, saved or dismissed right on the card. No
// detail page needed. A new user leaves with something in their list.
export default function StarterPicks({ onNavigate, payload }) {
  const [picks, setPicks] = useState(null);
  const [saved, setSaved] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const next = payload?.next || 'onboarding-import';

  useEffect(() => { api.getPicks(15).then((r) => setPicks(r?.status === 'success' ? r.data : [])).catch(() => setPicks([])); }, []);

  const save = async (p) => {
    if (busy) return;
    setBusy(p._id);
    const r = await api.savePlace(p._id).catch(() => null);
    setBusy(null);
    if (r?.status === 'success') setSaved((s) => new Set([...s, p._id]));
  };
  const skip = (p) => setPicks((xs) => xs.filter((x) => x._id !== p._id));

  return (
    <div className="wt-screen">
      <Progress step={3} />
      <h1 className="wt-title lg" style={{ fontSize: 31, marginBottom: 9 }}>A few things you might<br />want to try</h1>
      <p className="wt-sub" style={{ marginBottom: 20 }}>{saved.size ? `${saved.size} in your list. Keep going, or continue.` : 'Tap ♡ to keep one. Not for you? Swipe it away with ✕.'}</p>

      {picks === null && <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', fontSize: 14 }}>Finding things near you…</div>}
      {picks?.length === 0 && <p className="wt-sub">Nothing seeded for your city yet — your own saves will fill this in.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(picks || []).map((p) => {
          const on = saved.has(p._id);
          return (
            <div key={p._id} style={{ display: 'flex', gap: 12, padding: '14px 14px 12px', borderRadius: 14, background: 'var(--card)', border: `1px solid ${on ? 'var(--teal)' : 'var(--line)'}` }}>
              <CategoryTile category={p.category} size={44} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="wt-row-title" style={{ fontSize: 18 }}>{p.canonicalName}</span>
                <span className="wt-row-meta">{[getCategoryTile(p.category).label, p.city, ...(p.aggregatedTake?.chips || []).slice(0, 1)].filter(Boolean).join(' · ')}</span>
                <span style={{ fontSize: 13.5, color: 'var(--teal-d)', marginTop: 2 }}>✨ {p.reason}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => save(p)} disabled={on || busy === p._id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: 0, background: on ? 'var(--teal)' : 'var(--teal-soft)', color: on ? '#fff' : 'var(--teal-d)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Icon name={on ? 'check' : 'bookmark'} size={15} stroke={2.2} />{on ? 'In your list' : 'Wanna try'}
                  </button>
                  {!on && <button type="button" onClick={() => skip(p)} aria-label="Not for me" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'none', color: 'var(--mute)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Not for me</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button onClick={() => onNavigate(next)}>{saved.size ? 'Continue' : 'Skip for now'}</Button>
      </div>
    </div>
  );
}
