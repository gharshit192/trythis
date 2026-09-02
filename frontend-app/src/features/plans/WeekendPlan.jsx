import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import CategoryTile from '../../components/CategoryTile';
import { getCategoryTile } from '../../lib/categoryMeta';

// Your Saturday, from your own saves (brief §27): 2–4 places within 10 km,
// timed and ordered, with travel between them and a rough cost. Swap a stop,
// share it, or commit — which marks every stop Planning for that morning.
const money = (n) => (n ? `₹${Number(n).toLocaleString('en-IN')}` : null);

export default function WeekendPlan({ onNavigate, onBack, payload }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('loading');   // 'loading' | 'building' | 'committing' | null
  const [error, setError] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [committed, setCommitted] = useState(false);
  const pos = payload?.lat != null ? { lat: payload.lat, lng: payload.lng } : null;

  const build = async (exclude = excluded) => {
    if (!pos) { setError('Turn on location to plan from where you are.'); setBusy(null); return; }
    setBusy('building'); setError(null); setCommitted(false);
    const r = await api.buildWeekendPlan(pos.lat, pos.lng, exclude).catch(() => null);
    setBusy(null);
    if (r?.status === 'success') setPlan(r.data); else setError(r?.error?.message || 'Could not build a plan.');
  };
  useEffect(() => {
    api.latestWeekendPlan().then((r) => { if (r?.status === 'success' && r.data && !payload?.fresh) { setPlan(r.data); setBusy(null); } else build([]); }).catch(() => build([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swap = (stop) => { const next = [...excluded, String(stop.saveId)]; setExcluded(next); build(next); };
  const share = async () => {
    if (!plan) return;
    const lines = plan.stops.map((s) => `${s.start} · ${s.title}${s.note ? ` — ${s.note}` : ''}`);
    const text = `${plan.title} (${plan.dayLabel})\n${lines.join('\n')}${plan.estimatedCostInr ? `\nAbout ${money(plan.estimatedCostInr)} for the day` : ''}\n— planned with Wanna Try`;
    try { if (navigator.share) await navigator.share({ title: plan.title, text }); else { await navigator.clipboard?.writeText(text); setError('Copied the plan.'); } } catch {}
  };
  const commit = async () => {
    if (!plan) return;
    setBusy('committing');
    const r = await api.commitWeekendPlan(plan._id).catch(() => null);
    setBusy(null);
    if (r?.status === 'success') setCommitted(true); else setError(r?.error?.message || 'Could not mark those as planned.');
  };
  const dateLabel = plan?.forDate ? new Date(plan.forDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : plan?.dayLabel;

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <div className="acts">
          {plan && <button type="button" className="wt-iconbtn" aria-label="Share plan" onClick={share}><Icon name="share" size={21} /></button>}
          <button type="button" className="wt-iconbtn" aria-label="Rebuild" onClick={() => { setExcluded([]); build([]); }}><Icon name="sparkle" size={21} /></button>
        </div>
      </div>
      <span className="wt-eyebrow" style={{ marginBottom: 10 }}>{dateLabel || 'This weekend'}</span>
      <h1 className="wt-title lg" style={{ marginBottom: 8 }}>{plan?.title || 'Your Saturday'}</h1>
      {plan && (
        <p className="wt-sub" style={{ marginBottom: 20 }}>{plan.stops.length} of your saves, {plan.totalTravelMin ? `about ${plan.totalTravelMin} min of travel` : 'close together'}{plan.estimatedCostInr ? ` · around ${money(plan.estimatedCostInr)}` : ''}.</p>
      )}
      {error && <div className={`wt-note ${/Copied/.test(error) ? 'info' : 'error'}`}>{error}</div>}
      {busy === 'loading' || busy === 'building' ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--mute)', fontSize: 14, padding: '20px 0' }}><span className="wt-spinner" />{busy === 'building' ? 'Putting your saves in order…' : 'Opening…'}</div>
      ) : plan && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {plan.stops.map((s, i) => (
            <li key={String(s.saveId) + i}>
              {i > 0 && (s.travelMinFromPrev || 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px 22px', fontSize: 12.5, color: 'var(--faint)' }}>
                  <span style={{ width: 2, height: 18, background: 'var(--line)', marginLeft: 9 }} />
                  {s.travelMinFromPrev} min{s.distanceKmFromPrev ? ` · ${s.distanceKmFromPrev} km` : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 46, flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: 'var(--teal)', paddingTop: 12 }}>{s.start}</span>
                <CategoryTile category={s.category} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <button type="button" onClick={() => onNavigate('save-detail', { id: s.saveId })} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span className="wt-row-title">{s.title}</span>
                  </button>
                  <span className="wt-row-meta">{[getCategoryTile(s.category).label, s.area || s.city, s.priceRange, s.durationMin ? `${s.durationMin} min` : null].filter(Boolean).join(' · ')}</span>
                  {s.note && <span style={{ fontSize: 13.5, color: 'var(--teal-d)' }}>{s.note}</span>}
                  <button type="button" onClick={() => swap(s)} className="wt-link" style={{ background: 'none', border: 0, padding: 0, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4 }}>Swap this one</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {plan?.tip && <p style={{ fontSize: 14, color: 'var(--mute)', margin: '14px 0 0', lineHeight: 1.5 }}>✨ {plan.tip}</p>}

      <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan && (committed
          ? <div className="wt-note info">Planned. Each stop will remind you that morning.</div>
          : <Button onClick={commit} disabled={busy === 'committing'} icon="calendar">{busy === 'committing' ? 'Marking…' : `Plan it for ${plan.dayLabel}`}</Button>)}
        {plan && <Button variant="secondary" icon="share" onClick={share}>Share the plan</Button>}
        {!plan && busy === null && <Button variant="secondary" onClick={() => onNavigate('explore')}>Find something nearby</Button>}
      </div>
    </div>
  );
}
