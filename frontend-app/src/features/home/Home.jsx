import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import ListRow from '../../components/ListRow';
import SectionLabel from '../../components/SectionLabel';
import SearchBar from '../../components/SearchBar';
import Button from '../../components/Button';
import { relativeTime, formatDistance } from '../../lib/format';

const DAY = 86400000;
const placeLine = (s) => s.extractedLocation?.name || s.extractedLocation?.city || null;
const priceLine = (s) => s.aiAnalysis?.structuredData?.place?.priceRange || null;
const metaOf = (s) => [placeLine(s), priceLine(s)].filter(Boolean).join(' · ') || relativeTime(s.createdAt);

// Rails render only when they have something true to show (ADR 0014); the
// order is the priority order from the design.
export default function Home({ onNavigate, payload, nearbySaves = [] }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [saves, setSaves] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  // New-user supply (ADR 0014): curated template saves to copy in one tap, and
  // places other people on Wanna Try have saved. Fetched only when the list is
  // empty, so a returning user never pays for them.
  const [templates, setTemplates] = useState([]);
  const [popular, setPopular] = useState([]);
  const [forYou, setForYou] = useState([]);
  // Plan this weekend (brief §27): only offered when 2+ saved places are within 10 km.
  const [weekend, setWeekend] = useState(null);   // { count, lat, lng }
  useEffect(() => {
    if (loading || saves.length < 2 || !navigator.geolocation || localStorage.getItem('location_requested') !== 'true') return;
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: lat, longitude: lng } = p.coords;
      api.weekendCandidates(lat, lng).then((r) => { if (r?.status === 'success' && r.data.count >= 2) setWeekend({ count: r.data.count, lat, lng }); }).catch(() => {});
    }, () => {}, { timeout: 8000, maximumAge: 300000 });
  }, [loading, saves.length]);
  const [copying, setCopying] = useState(null);
  // Surprise me (brief §15): one pick at a time from places you haven't saved, with a reason.
  const [surprise, setSurprise] = useState(null);       // null | 'loading' | { pool, i }
  const [surpriseSaved, setSurpriseSaved] = useState(false);
  const openSurprise = async () => {
    setSurprise('loading'); setSurpriseSaved(false);
    const r = await api.getPicks(12).catch(() => null);
    const pool = r?.status === 'success' ? r.data : [];
    setSurprise({ pool, i: 0 });
  };
  const another = () => { setSurpriseSaved(false); setSurprise((s) => (s && s.pool ? { pool: s.pool, i: (s.i + 1) % Math.max(1, s.pool.length) } : s)); };
  const keepSurprise = async () => {
    const p = surprise?.pool?.[surprise.i]; if (!p) return;
    const r = await api.savePlace(p._id).catch(() => null);
    if (r?.status === 'success') { setSurpriseSaved(true); load(true); }
  };

  const load = async (force = false) => {
    try {
      const [savesRes, badge] = await Promise.all([api.getSaves({ force }), api.getBadgeCount().catch(() => null)]);
      if (savesRes?.status === 'success') setSaves(savesRes.data || []);
      const n = badge?.data?.count ?? badge?.count;
      if (typeof n === 'number') setUnread(n);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(!!payload?.refresh); }, [payload?.refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading || !saves.length) return;
    api.getPicks(4).then((r) => r?.status === 'success' && setForYou((r.data || []).slice(0, 3))).catch(() => {});
  }, [loading, saves.length]);
  useEffect(() => {
    if (loading || saves.length) return;
    api.getTemplateSaves().then((r) => r?.status === 'success' && setTemplates((r.data || []).slice(0, 6))).catch(() => {});
    api.getTrendingPlaces(6).then((r) => r?.status === 'success' && setPopular(r.data || [])).catch(() => {});
  }, [loading, saves.length]);

  const copyTemplate = async (t) => {
    setCopying(t._id);
    try { const r = await api.copyTemplateSave(t._id); if (r?.status === 'success') await load(true); }
    finally { setCopying(null); }
  };

  const live = saves.filter((s) => s.intentStatus !== 'dismissed' && s.intentStatus !== 'tried');
  const now = Date.now();
  const planning = live.filter((s) => s.intentStatus === 'planned' || now - new Date(s.createdAt) < 2 * DAY).slice(0, 3);
  const near = nearbySaves.filter((s) => !planning.find((p) => p._id === s._id)).slice(0, 3);
  const waiting = live.filter((s) => s.intentStatus === 'saved' && now - new Date(s.createdAt) > 60 * DAY).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 3);
  const city = user?.location?.city || user?.settings?.location?.city;
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  const open = (s) => onNavigate('save-detail', { id: s._id });

  return (
    <div className="wt-screen has-nav">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13.5, color: 'var(--mute)' }}>{city ? `${day} · ${city}` : day}</span>
          <h1 className="wt-title">What do you<br />wanna try?</h1>
        </div>
        <button type="button" onClick={() => onNavigate('notifications')} aria-label="Notifications"
          style={{ width: 42, height: 42, borderRadius: 21, border: '1px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, cursor: 'pointer', color: 'var(--ink)' }}>
          <Icon name="bell" size={21} />
          {unread > 0 && <span style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, background: 'var(--attention)', border: '2px solid var(--card)' }} />}
        </button>
      </div>

      <SearchBar placeholder={saves.length ? `Search ${saves.length} things you saved` : 'Search'} onClick={() => onNavigate('search')} style={{ marginBottom: saves.length ? 10 : 24 }} />
      {saves.length > 0 && (
        <button type="button" onClick={() => onNavigate('ask')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 24, padding: '11px 14px', borderRadius: 12, background: 'var(--teal-soft)', border: 0, color: 'var(--teal-d)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <Icon name="sparkle" size={18} />
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>Ask about anything you saved</span>
          <Icon name="forward" size={16} />
        </button>
      )}
      <button type="button" onClick={openSurprise}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: saves.length ? -14 : -14, marginBottom: 24, padding: '11px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ color: 'var(--cat-food)' }}><Icon name="star" size={18} /></span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>Surprise me</span>
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>one thing, near you</span>
      </button>
      {surprise && (
        <div className="wt-sheet" onClick={() => setSurprise(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            {surprise === 'loading' ? <p className="wt-sub">Picking one…</p> : !surprise.pool?.length ? (
              <><p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px' }}>Nothing to surprise you with yet</p><p className="wt-sub" style={{ marginBottom: 16 }}>Set your city in Me, or save a few things and try again.</p><Button small variant="secondary" onClick={() => setSurprise(null)}>Close</Button></>
            ) : (() => { const p = surprise.pool[surprise.i]; return (
              <>
                <span className="wt-eyebrow" style={{ color: 'var(--cat-food)', marginBottom: 10 }}>You might like this</span>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.1, margin: '0 0 6px' }}>{p.canonicalName}</p>
                <p className="wt-row-meta" style={{ margin: '0 0 8px' }}>{[p.city, ...(p.aggregatedTake?.chips || []).slice(0, 2)].filter(Boolean).join(' · ')}</p>
                <p style={{ fontSize: 14.5, color: 'var(--teal-d)', margin: '0 0 18px' }}>✨ {p.reason}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button small onClick={surpriseSaved ? another : keepSurprise} icon={surpriseSaved ? 'check' : 'bookmark'}>{surpriseSaved ? 'Saved — next' : 'Wanna try'}</Button>
                  <Button small variant="secondary" onClick={another} style={{ width: 'auto', padding: '0 16px' }}>Show me another</Button>
                </div>
                <button type="button" className="wt-link" onClick={() => { setSurprise(null); onNavigate('place', { id: p._id }); }} style={{ background: 'none', border: 0, marginTop: 14, fontSize: 13.5, cursor: 'pointer', padding: 0 }}>See the details</button>
              </>); })()}
          </div>
        </div>
      )}

      {!loading && saves.length === 0 && (
        <>
          {/* First-run: say what to do, in one card, with the two real ways in. */}
          <div style={{ padding: '20px 18px', borderRadius: 14, background: 'var(--teal-d)', color: '#fff', marginBottom: 26 }}>
            <span className="wt-eyebrow" style={{ color: 'var(--sand)', display: 'block', marginBottom: 8 }}>Start here</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2, margin: '0 0 8px' }}>Save one thing you want to try.</p>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: '0 0 16px', color: 'rgba(255,255,255,.78)' }}>A reel, a link, a screenshot, or just say it. We read it, keep the details, and bring it back when you can go.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button small onDark onClick={() => onNavigate('add-save')} style={{ flex: 1 }}>Save something</Button>
              <Button small onDark variant="secondary" onClick={() => onNavigate('voice')} style={{ width: 'auto', padding: '0 16px' }}>Say it</Button>
            </div>
          </div>

          {templates.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel>Try one of these</SectionLabel>
              {templates.map((t) => (
                <ListRow key={t._id} category={t.category} title={t.title}
                  meta={[t.extractedLocation?.city, t.aiAnalysis?.structuredData?.place?.priceRange].filter(Boolean).join(' · ') || 'Example save · tap + to keep it'}
                  trailIcon={<span style={{ color: copying === t._id ? 'var(--faint)' : 'var(--teal)' }}><Icon name={copying === t._id ? 'clock' : 'plus'} size={20} stroke={2.2} /></span>}
                  onClick={() => copying ? null : copyTemplate(t)} />
              ))}
            </section>
          )}

          {popular.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel action="Explore" onAction={() => onNavigate('explore')}>Popular on Wanna Try</SectionLabel>
              {popular.map((p) => (
                <ListRow key={p._id} category={p.category} title={p.canonicalName} meta={[p.city, ...(p.vibeTags || []).slice(0, 2)].filter(Boolean).join(' · ')}
                  reason={p.saveCount > 1 ? `Saved by ${p.saveCount} people` : 'Saved by someone on Wanna Try'} onClick={() => onNavigate('place', { id: p._id })} />
              ))}
            </section>
          )}

          {templates.length === 0 && popular.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['instagram', 'place', 'Share a reel', 'Open any reel → Share → Wanna Try. We pull out the place, price and what to order.'],
                ['image', 'shop', 'Drop in screenshots', 'A menu, a chat, a list of places a friend sent — we read every line.'],
                ['mic', 'food', 'Just say it', '"Goa airport pe Rahul mila, six months mein follow up" becomes a note that comes back on the day.'],
              ].map(([icon, kind, title, text]) => (
                <div key={title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                  <span className={`wt-tile ${kind}`}><Icon name={icon} size={20} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</span>
                    <span className="wt-row-meta" style={{ fontSize: 13.5 }}>{text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {weekend && (
        <button type="button" onClick={() => onNavigate('weekend-plan', { lat: weekend.lat, lng: weekend.lng })}
          style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', marginBottom: 24, padding: '16px 16px', borderRadius: 14, background: 'var(--teal-d)', border: 0, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand)', flexShrink: 0 }}><Icon name="calendar" size={20} /></span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.15 }}>Plan this weekend</span>
            <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,.75)' }}>{weekend.count} things you saved are within 10 km. We'll put three in order.</span>
          </span>
          <Icon name="forward" size={18} />
        </button>
      )}

      {forYou.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel action="More" onAction={() => onNavigate('explore')}>Made for you</SectionLabel>
          {forYou.map((p) => (
            <ListRow key={p._id} category={p.category} title={p.canonicalName} meta={[p.city, ...(p.aggregatedTake?.chips || []).slice(0, 2)].filter(Boolean).join(' · ')}
              reason={p.reason} onClick={() => onNavigate('place', { id: p._id })} />
          ))}
        </section>
      )}

      {planning.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel action={String(planning.length)}>{planning.every((s) => s.intentStatus === 'planned') ? 'Planning this weekend' : 'Up next'}</SectionLabel>
          {planning.map((s) => <ListRow key={s._id} category={s.category} title={s.title} meta={metaOf(s)} onClick={() => open(s)} />)}
        </section>
      )}

      {near.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel action="See all" onAction={() => onNavigate('explore')}>Worth trying near you</SectionLabel>
          {near.map((s) => (
            <ListRow key={s._id} category={s.category} title={s.title} meta={placeLine(s)}
              reason={s.distanceMetres != null ? `${formatDistance(s.distanceMetres)} away` : undefined}
              trail={s.distanceMetres != null ? formatDistance(s.distanceMetres) : undefined} onClick={() => open(s)} />
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel action="All" onAction={() => onNavigate('saved')}>Still waiting for you</SectionLabel>
          {waiting.map((s) => (
            <ListRow key={s._id} category={s.category} title={s.title} meta={metaOf(s)}
              reason={`Saved ${relativeTime(s.createdAt).toLowerCase()}. Still want to try it?`} onClick={() => open(s)} />
          ))}
        </section>
      )}
    </div>
  );
}
