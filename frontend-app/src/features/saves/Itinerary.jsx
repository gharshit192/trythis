import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import Chip from '../../components/Chip';

// Day-wise plan from planEngine (POST /saves/:id/plan). Every stop credits its
// source where the engine knows it; engine-added stops say so.
export default function Itinerary({ onNavigate, onBack, payload }) {
  const { id, title, destination } = payload || {};
  const [plan, setPlan] = useState(null);
  const [day, setDay] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api.getPlan(id, '').then((r) => {
      if (!alive) return;
      if (r?.status === 'success') setPlan(r.data);
      else setError(r?.error?.message || 'Could not build a plan for this save yet.');
    }).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [id]);

  const days = plan?.dailyPlan || [];
  const current = days.find((d) => d.day === day) || days[0];
  const budget = plan?.estimatedBudgetInr ? `₹${plan.estimatedBudgetInr.toLocaleString('en-IN')} est.` : null;
  const stayArea = current?.stayArea || destination;
  const hoursAt = (i, stops) => { let h = 9; for (let k = 0; k < i; k++) h += (stops[k].durationHr || 2) + 0.5; const hh = Math.min(21, Math.round(h)); return `${hh}:00`; };

  return (
    <div className="wt-screen">
      <div className="wt-topbar" style={{ marginBottom: 22 }}>
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <div className="acts">
          {current?.mapsLink && <a className="wt-iconbtn" href={current.mapsLink} target="_blank" rel="noreferrer" aria-label="Route on map"><Icon name="pin" size={21} /></a>}
          {current?.bookingLink && <a className="wt-iconbtn" href={current.bookingLink} target="_blank" rel="noreferrer" aria-label="Stays"><Icon name="share" size={21} /></a>}
        </div>
      </div>
      <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em' }}>Your plan</span>
      <h1 className="wt-title" style={{ margin: '8px 0 6px' }}>{plan?.tripTitle || title || destination}</h1>
      <span style={{ fontSize: 14, color: 'var(--mute)', marginBottom: 18 }}>
        {[days.length ? `${days.length} day${days.length === 1 ? '' : 's'}` : null, budget, stayArea ? `staying in ${stayArea}` : null].filter(Boolean).join(' · ')}
      </span>

      {!plan && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', color: 'var(--mute)', fontSize: 14 }}><span className="wt-spinner" />Putting the days in order…</div>
      )}
      {error && <div className="wt-note error">{error}</div>}

      {days.length > 0 && (
        <>
          <div className="wt-chips" style={{ marginBottom: 18 }}>
            {days.map((d) => <Chip key={d.day} small on={d.day === (current?.day)} onClick={() => setDay(d.day)}>Day {d.day}</Chip>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{current.theme}</span>
            <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{current.stops.length} stop{current.stops.length === 1 ? '' : 's'}{current.travelTimeTotalHr ? ` · ${current.travelTimeTotalHr}h moving` : ''}</span>
          </div>
          {current.stops.map((s, i) => (
            <div key={i} className="wt-timeline">
              <div className="t"><span>{hoursAt(i, current.stops)}</span>{i < current.stops.length - 1 && <i />}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, paddingBottom: 8 }}>
                <span className="wt-row-title" style={{ fontSize: 17 }}>{s.place}</span>
                {s.notes && <span className="wt-row-meta">{s.notes}</span>}
                <span className="wt-row-reason" style={{ color: (plan.places || []).some((p) => p.name?.toLowerCase() === s.place.toLowerCase() && p.tipFromReel) ? 'var(--teal)' : 'var(--faint)' }}>
                  {(plan.places || []).find((p) => p.name?.toLowerCase() === s.place.toLowerCase())?.tipFromReel ? 'From your reel' : 'Added to fill the day — swap it'}
                </span>
              </div>
            </div>
          ))}
          {plan.warnings?.length > 0 && <div className="wt-note info" style={{ marginTop: 12 }}>{plan.warnings[0]}</div>}
        </>
      )}

      {plan && (
        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 10 }}>
          <Button small onClick={() => onNavigate('save-detail', { id })}>Save plan</Button>
          <Button small variant="secondary" style={{ width: 'auto', padding: '0 18px' }} onClick={onBack}>Back</Button>
        </div>
      )}
    </div>
  );
}
