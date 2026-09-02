import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Chip from '../../components/Chip';
import SearchBar from '../../components/SearchBar';
import ListRow from '../../components/ListRow';
import EmptyState from '../../components/EmptyState';
import { relativeTime } from '../../lib/format';
import { getCategoryTile } from '../../lib/categoryMeta';

// Saved, tabbed by the intent lifecycle (ADR 0015): Want to try · Planning · Tried.
const TABS = [
  { id: 'saved',   label: 'Want to try' },
  { id: 'planned', label: 'Planning' },
  { id: 'tried',   label: 'Tried' },
];
const KINDS = [
  { id: 'all',   label: 'All' },
  { id: 'near',  label: 'Near me' },
  { id: 'place', label: 'Cafes & places' },
  { id: 'food',  label: 'Food' },
  { id: 'shop',  label: 'Shopping' },
  { id: 'learn', label: 'Watch' },
];
const shortAge = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
};

export default function Saved({ onNavigate, payload, nearbySaves = [] }) {
  const nearIds = new Set(nearbySaves.map((s) => s._id));
  const [tab, setTab] = useState(payload?.tab || 'saved');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSaves({ force: !!payload?.refresh }).then((r) => {
      if (r?.status === 'success') setSaves(r.data || []);
    }).finally(() => setLoading(false));
  }, [payload?.refresh]);

  const counts = Object.fromEntries(TABS.map((t) => [t.id, saves.filter((s) => (s.intentStatus || 'saved') === t.id).length]));
  const needle = q.trim().toLowerCase();
  const matches = (s) => !needle || [s.title, s.extractedLocation?.name, s.extractedLocation?.city, s.aiAnalysis?.summary, ...(s.tags || [])]
    .filter(Boolean).join(' ').toLowerCase().includes(needle);
  // Long lists render a page at a time; the sentinel at the bottom loads the next
  // page as it scrolls into view — no button.
  const PAGE = 20;
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef(null);
  useEffect(() => { setLimit(PAGE); }, [tab, kind, q]);
  useEffect(() => {
    const el = sentinel.current; if (!el) return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE); }, { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  });
  const rows = saves
    .filter(matches)
    .filter((s) => (s.intentStatus || 'saved') === tab)
    .filter((s) => kind === 'all' || (kind === 'near' ? nearIds.has(s._id) : getCategoryTile(s.category).kind === kind));

  const metaOf = (s) => {
    const t = getCategoryTile(s.category);
    const where = s.extractedLocation?.name || s.extractedLocation?.city;
    const price = s.aiAnalysis?.structuredData?.place?.priceRange || (s.aiAnalysis?.structuredData?.product?.price ? `₹${s.aiAnalysis.structuredData.product.price}` : null);
    if (tab === 'tried' && s.rating) return [t.label, '★'.repeat(s.rating), s.triedAt ? relativeTime(s.triedAt) : null].filter(Boolean).join(' · ');
    return [t.label, where, price].filter(Boolean).join(' · ');
  };

  return (
    <div className="wt-screen has-nav">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="wt-title">Saved</h1>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--teal)', cursor: 'pointer' }} onClick={() => onNavigate('collections')}>Collections</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 0, padding: '0 0 12px', marginRight: 22, cursor: 'pointer', fontSize: 15, fontWeight: tab === t.id ? 600 : 500, color: tab === t.id ? 'var(--ink)' : 'var(--mute)', borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1 }}>
            {t.label} <span style={{ color: 'var(--faint)', fontWeight: 500 }}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <SearchBar value={q} onChange={setQ} placeholder={`Search ${saves.length} saved`} style={{ marginBottom: 12 }} />
      <div className="wt-chips" style={{ marginBottom: 6 }}>
        {KINDS.map((k) => <Chip key={k.id} small on={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState
          title={needle ? 'Nothing matches' : tab === 'tried' ? 'Nothing tried yet' : tab === 'planned' ? 'Nothing planned' : 'Nothing saved yet'}
          text={needle ? 'Try a place, a dish, a creator, or a word from the reel.' : tab === 'tried' ? 'When you go, mark it tried on the item and it lands here.' : tab === 'planned' ? 'Move a save to Planning when you mean to go soon.' : 'Share a reel or paste a link to start your list.'}
          action={tab === 'saved' ? 'Add a save' : undefined} onAction={() => onNavigate('add-save')} />
      ) : rows.slice(0, limit).map((s) => (
        <ListRow key={s._id} category={s.category} title={s.title} meta={metaOf(s)} trail={shortAge(s.createdAt)}
          onClick={() => onNavigate('save-detail', { id: s._id })} />
      ))}
      {rows.length > limit && <div ref={sentinel} style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--faint)' }}>{rows.length - limit} more…</div>}
    </div>
  );
}
