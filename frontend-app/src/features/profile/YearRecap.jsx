import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import ListRow from '../../components/ListRow';
import SectionLabel from '../../components/SectionLabel';
import { getCategoryTile } from '../../lib/categoryMeta';

// "Your 2026" (brief §29): what you actually did this year, from your own
// tried list. The number that matters is tried, not saved.
const KIND_LABEL = { place: 'places & trips', food: 'food', shop: 'things bought', learn: 'watched & read', none: 'other' };

export default function YearRecap({ onBack }) {
  const [saves, setSaves] = useState(null);
  const year = new Date().getFullYear();
  useEffect(() => { api.getSaves().then((r) => setSaves(r?.status === 'success' ? r.data || [] : [])); }, []);
  if (!saves) return <div className="wt-screen dark" />;

  const tried = saves.filter((s) => s.intentStatus === 'tried' && new Date(s.triedAt || s.updatedAt).getFullYear() === year);
  const byKind = tried.reduce((m, s) => { const k = getCategoryTile(s.category).kind; m[k] = (m[k] || 0) + 1; return m; }, {});
  const cities = [...new Set(tried.map((s) => s.extractedLocation?.city).filter(Boolean))];
  const best = [...tried].filter((s) => s.rating).sort((a, b) => b.rating - a.rating)[0];
  const months = tried.reduce((m, s) => { const k = new Date(s.triedAt || s.updatedAt).toLocaleDateString(undefined, { month: 'long' }); m[k] = (m[k] || 0) + 1; return m; }, {});
  const topMonth = Object.entries(months).sort((a, b) => b[1] - a[1])[0];
  const waiting = saves.filter((s) => !['tried', 'dismissed'].includes(s.intentStatus)).length;
  const share = async () => {
    const text = `My ${year} on Wanna Try: ${tried.length} new things tried${cities.length ? ` across ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''}${best ? ` — best of all, ${best.title}` : ''}.`;
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard?.writeText(text); } catch {}
  };

  return (
    <div className="wt-screen dark">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack} style={{ color: '#fff' }}><Icon name="back" size={22} /></button>
        <button type="button" className="wt-iconbtn" aria-label="Share" onClick={share} style={{ color: '#fff' }}><Icon name="share" size={21} /></button>
      </div>
      <span className="wt-eyebrow" style={{ color: 'var(--sand)', marginBottom: 10 }}>Your {year}</span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 72, lineHeight: 1, margin: '0 0 6px', color: '#fff' }}>{tried.length}</h1>
      <p style={{ fontSize: 18, color: 'rgba(255,255,255,.85)', margin: '0 0 26px', fontFamily: 'var(--font-display)' }}>{tried.length === 1 ? 'new thing tried' : 'new things tried'}{cities.length ? ` · ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''}</p>

      {tried.length === 0 ? (
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>Nothing marked tried yet this year. {waiting ? `${waiting} things are waiting — pick one for this weekend.` : 'Save something, go, and mark it tried.'}</p>
      ) : (
        <>
          <div className="wt-stat-grid" style={{ marginBottom: 22, background: 'transparent', gap: 10 }}>
            {Object.entries(byKind).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => (
              <div key={k} className="wt-stat" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', color: '#fff', borderRadius: 12 }}><span className="k" style={{ color: 'var(--sand)' }}>{KIND_LABEL[k]}</span><span className="v">{n}</span></div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, color: 'rgba(255,255,255,.85)', marginBottom: 24 }}>
            {topMonth && <span>Busiest month: <b style={{ color: '#fff' }}>{topMonth[0]}</b> ({topMonth[1]})</span>}
            {cities.length > 0 && <span>Cities: <b style={{ color: '#fff' }}>{cities.slice(0, 5).join(', ')}</b></span>}
            <span>Still waiting: <b style={{ color: '#fff' }}>{waiting}</b></span>
          </div>
          {best && (
            <section style={{ marginBottom: 18 }}>
              <SectionLabel style={{ color: 'var(--sand)' }}>Best of the year</SectionLabel>
              <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '4px 12px' }}>
                <ListRow category={best.category} title={best.title} meta={['★'.repeat(best.rating), best.extractedLocation?.city, best.triedNote].filter(Boolean).join(' · ')} />
              </div>
            </section>
          )}
        </>
      )}
      <div style={{ marginTop: 'auto' }}><Button onDark onClick={share} icon="share">Share your year</Button></div>
    </div>
  );
}
