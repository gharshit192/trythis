import Icon from '../../components/Icon';
import Button from '../../components/Button';
import SectionLabel from '../../components/SectionLabel';
import Banner from '../../components/Banner';
import { KIND_HUE } from '../../lib/categoryMeta';
import SaveSections from './SaveSections';

// The travel save's own layout (ADR 0015): what the reels already told us —
// days, budget, season, places — and one offer: Plan this trip.
const dayCount = (duration = '') => (String(duration).match(/(\d+)\s*(day|night|d\b)/i) || [])[1] || null;
const short = (s = '') => String(s).replace(/^(approx\.?|around|about)\s*/i, '').slice(0, 14);

export default function Trip({ save, onNavigate, onBack, onMore, statusControl }) {
  const it = save?.aiAnalysis?.structuredData?.itinerary || {};
  const dest = it.destination || save?.extractedLocation?.city || save?.title;
  const days = dayCount(it.duration);
  const places = (it.highlights || []).map((h) => ({ name: h, kind: /(thali|food|cafe|eat|restaurant|breakfast|dinner)/i.test(h) ? 'food' : 'place' }));
  const perDest = it.perDestinationCosts || [];
  const reels = Math.max(1, save?.sourceCount || 1);
  const planned = !!save?.tripPlan?.data;
  const plannedDays = save?.tripPlan?.data?.dailyPlan?.length;

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <button type="button" className="wt-iconbtn" aria-label="More" onClick={onMore}><Icon name="more" size={21} /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--teal)' }} />
        <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em' }}>Trip</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>· {save?.source === 'voice' ? 'from your voice note' : `from ${reels} reel${reels === 1 ? '' : 's'}`}</span>
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 20 }}>{save?.title}</h1>
      {statusControl && <div style={{ marginBottom: 12 }}>{statusControl}</div>}
      {save?.intentStatus === 'planned' && (
        <div style={{ marginBottom: 22, padding: '13px 14px', borderRadius: 12, background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--teal)' }}><Icon name="calendar" size={20} /></span>
          <span style={{ flex: 1, fontSize: 14.5, color: 'var(--teal-d)', lineHeight: 1.4 }}>{planned ? `Your ${plannedDays ? `${plannedDays}-day ` : ''}plan is ready.` : 'Planning this trip — build the day-by-day plan below.'}</span>
          {planned && <button type="button" className="wt-link" style={{ background: 'none', border: 0, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onNavigate('itinerary', { id: save._id, title: save.title, destination: dest, days })}>See & share</button>}
        </div>
      )}

      <div className="wt-stat-grid" style={{ marginBottom: 22 }}>
        <div className="wt-stat"><span className="k">Days</span><span className="v">{days || '—'}</span></div>
        <div className="wt-stat"><span className="k">Budget</span><span className="v">{it.estimatedCost ? short(it.estimatedCost) : '—'}</span></div>
        <div className="wt-stat"><span className="k">Best in</span><span className="v">{it.bestSeason ? short(it.bestSeason) : '—'}</span></div>
      </div>

      {places.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>{save?.source === 'voice' ? `${places.length} leg${places.length === 1 ? '' : 's'}, as you said them` : `${places.length} place${places.length === 1 ? '' : 's'}, from your reels`}</SectionLabel>
          {places.slice(0, 5).map((p) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: KIND_HUE[p.kind], flexShrink: 0 }} />
              <span style={{ fontSize: 15, flex: 1 }}>{p.name}</span>
              {perDest.find((c) => c.destination === p.name)?.cost && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{perDest.find((c) => c.destination === p.name).cost}</span>}
            </div>
          ))}
          {places.length > 5 && <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500, display: 'block', paddingTop: 10 }}>and {places.length - 5} more</span>}
        </section>
      )}

      {save?.aiAnalysis?.summary && (
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--mute)', margin: '0 0 20px' }}>{save.aiAnalysis.summary}</p>
      )}
      <SaveSections save={save} hideItinerary />

      {planned
        ? <Banner icon="calendar">Your {plannedDays ? `${plannedDays}-day ` : ''}plan is saved with this trip — planned {new Date(save.tripPlan.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.</Banner>
        : <Banner icon="sparkle">We can put these in order by day{it.estimatedCost ? `, keep it under ${short(it.estimatedCost)}` : ''}, and start from wherever you're staying. Takes about a minute, once.</Banner>}

      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button onClick={() => onNavigate('itinerary', { id: save._id, title: save.title, destination: dest, days })}>{planned ? 'See your plan' : 'Plan this trip'}</Button>
        <Button variant="ghost" onClick={onBack}>Just keep it saved</Button>
      </div>
    </div>
  );
}
