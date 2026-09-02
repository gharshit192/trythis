import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import ListRow from '../../components/ListRow';
import SectionLabel from '../../components/SectionLabel';
import SearchBar from '../../components/SearchBar';
import Banner from '../../components/Banner';
import EmptyState from '../../components/EmptyState';
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

      <SearchBar placeholder={saves.length ? `Search ${saves.length} things you saved` : 'Search'} onClick={() => onNavigate('search')} style={{ marginBottom: 24 }} />

      {!loading && saves.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          text="Share a reel, a link or a screenshot — or bring in everything you've already saved on Instagram."
          action="Add your first save"
          onAction={() => onNavigate('add-save')}
        />
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
