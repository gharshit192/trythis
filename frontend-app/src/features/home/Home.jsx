import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import ListRow from '../../components/ListRow';
import SectionLabel from '../../components/SectionLabel';
import SearchBar from '../../components/SearchBar';
import Banner from '../../components/Banner';
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
  const [copying, setCopying] = useState(null);

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
  const old = live
    .filter((s) => s.intentStatus === 'saved' && now - new Date(s.createdAt) > 60 * DAY)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
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

      {old && (
        <Banner warm label={`Saved ${relativeTime(old.createdAt).toLowerCase()}`} onClick={() => open(old)}
          trailing={<Icon name="forward" size={18} />}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.25, color: 'var(--ink)' }}>{old.title}</span>
        </Banner>
      )}
    </div>
  );
}
