import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Chip from '../../components/Chip';
import ListRow from '../../components/ListRow';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import { formatDistance, distanceMetres } from '../../lib/format';
import { getCategoryTile } from '../../lib/categoryMeta';

// Explore replaces the Nearby tab (ADR 0015). One screen, every category; the
// chips are filters over three real sources — your saves, seeded places, and
// (gated) other people's saves. Every row says which (ADR 0014).
const RADII = [2000, 5000, 10000];
const SORTS = [['closest', 'Closest'], ['popular', 'Most saved'], ['viewed', 'Most viewed']];
const counts = (p) => [p.saveCount ? `Saved ${p.saveCount}` : null, p.viewCount ? `${p.viewCount} view${p.viewCount === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
const takeOf = (p) => p.aggregatedTake?.text ? p.aggregatedTake.text.split(/(?<=[.;!])\s/)[0].slice(0, 110) : null;
const CHIPS = [
  { id: 'near',     label: 'Near you' },
  { id: 'foryou',   label: 'For you' },
  { id: 'planned',  label: 'This weekend' },
  { id: 'place',    label: 'Cafes & places' },
  { id: 'food',     label: 'Food' },
  { id: 'shop',     label: 'Shopping' },
  { id: 'learn',    label: 'Watch & read' },
];

export default function Explore({ onNavigate, nearbySaves = [] }) {
  const [chip, setChip] = useState('near');
  const [saves, setSaves] = useState([]);
  const [near, setNear] = useState(nearbySaves);
  const [places, setPlaces] = useState([]);
  const [geo, setGeo] = useState('asking'); // asking | ok | denied
  const [forYou, setForYou] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [radius, setRadius] = useState(5000);
  const [hideSaved, setHideSaved] = useState(false);
  const [sort, setSort] = useState('closest');
  const [pos, setPos] = useState(null);
  const [saving, setSaving] = useState(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const flash = (t) => { setToast(t); setTimeout(() => setToast(null), 1800); };
  const RADIUS_M = radius;

  // Bookmark on a seeded row: keep it as your own save, right there.
  const savePlace = async (e, p) => {
    e.stopPropagation();
    if (saving || savedPlaceIds.has(p._id)) return;
    setSaving(p._id);
    const r = await api.savePlace(p._id).catch(() => null);
    setSaving(null);
    if (r?.status === 'success') { setSavedPlaceIds((s) => new Set([...s, p._id])); flash(r.data.alreadySaved ? 'Already in your list' : 'Saved to your list'); }
    else flash(r?.error?.message || 'Could not save');
  };

  const loadNearby = async (lat, lng, r) => {
    const [mine, seeded] = await Promise.all([
      api.getNearbySaves(lat, lng, r),
      api.getNearbyPlaces(lat, lng, r).catch(() => null),
    ]);
    if (mine?.status === 'success') setNear(mine.saves || []);
    if (seeded?.status === 'success') {
      // /places/nearby returns a bounding box without distances; measure here so
      // seeded rows sort and read like the user's own.
      setPlaces((seeded.data || seeded.places || [])
        .map((p) => ({ ...p, distanceMetres: p.geo?.lat != null ? Math.round(distanceMetres(lat, lng, p.geo.lat, p.geo.lng)) : null }))
        .sort((a, b) => (a.distanceMetres ?? 1e9) - (b.distanceMetres ?? 1e9)));
    }
  };
  useEffect(() => { if (pos) loadNearby(pos.lat, pos.lng, radius); }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.getSaves().then((r) => {
      if (r?.status !== 'success') return;
      const list = r.data || [];
      setSaves(list);
      const latest = list.filter((s) => s.intentStatus !== 'tried')[0];
      if (latest) api.getRecommendations(latest._id).then((x) => x?.status === 'success' && setForYou((x.data || []).map((p) => ({ ...p, because: latest.title })))).catch(() => {});
      // Nothing saved yet: "For you" is what other people on Wanna Try saved.
      else api.getTrendingPlaces(20).then((x) => x?.status === 'success' && setForYou((x.data || []).map((p) => ({ ...p, title: p.canonicalName, isPlace: true })))).catch(() => {});
    });
    if (!navigator.geolocation) { setGeo('denied'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setPos({ lat, lng });
      try {
        await loadNearby(lat, lng, RADIUS_M);
        setGeo('ok');
      } finally { setLoading(false); }
    }, () => { setGeo('denied'); setLoading(false); }, { timeout: 10000, maximumAge: 300000 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mineIds = new Set(near.map((s) => s._id));
  const rows = (() => {
    if (chip === 'near') {
      const own = near.map((s) => ({
        key: s._id, category: s.category, title: s.title,
        meta: s.extractedLocation?.name || s.extractedLocation?.city,
        reason: 'You saved this', trail: formatDistance(s.distanceMetres), saved: true,
        onClick: () => onNavigate('save-detail', { id: s._id }),
      }));
      const sorted = [...places].filter((p) => !mineIds.has(p._id)).sort((a, b) => sort === 'popular' ? (b.saveCount || 0) - (a.saveCount || 0) : sort === 'viewed' ? (b.viewCount || 0) - (a.viewCount || 0) : (a.distanceMetres ?? 1e9) - (b.distanceMetres ?? 1e9));
      const seeded = sorted.map((p) => ({
        key: p._id, category: p.category, title: p.canonicalName, place: p,
        meta: [getCategoryTile(p.category).label, p.city, ...(p.aggregatedTake?.chips || p.vibeTags || []).slice(0, 2)].filter(Boolean).join(' · '),
        reason: [takeOf(p), counts(p)].filter(Boolean).join(' — ') || 'Worth a look in your city',
        trail: p.distanceMetres != null ? formatDistance(p.distanceMetres) : undefined, saved: savedPlaceIds.has(p._id),
        onClick: () => onNavigate('place', { id: p._id }),
      }));
      return hideSaved ? seeded : [...own, ...seeded];
    }
    if (chip === 'foryou') {
      return forYou.slice(0, 20).map((s) => ({
        key: s._id, category: s.category, title: s.title,
        meta: s.isPlace ? [getCategoryTile(s.category).label, s.city, ...(s.aggregatedTake?.chips || s.vibeTags || []).slice(0, 2)].filter(Boolean).join(' · ') : (s.extractedLocation?.name || s.extractedLocation?.city || getCategoryTile(s.category).label),
        reason: s.isPlace ? ([takeOf(s), counts(s)].filter(Boolean).join(' — ') || 'Saved by someone on Wanna Try') : `Because you saved ${s.because}`,
        place: s.isPlace ? s : null, saved: s.isPlace ? savedPlaceIds.has(s._id) : true, onClick: () => onNavigate(s.isPlace ? 'place' : 'save-detail', { id: s._id }),
      }));
    }
    const pool = saves.filter((s) => s.intentStatus !== 'dismissed' && s.intentStatus !== 'tried');
    const pick = chip === 'planned'
      ? pool.filter((s) => s.intentStatus === 'planned')
      : pool.filter((s) => getCategoryTile(s.category).kind === chip);
    return pick.map((s) => ({
      key: s._id, category: s.category, title: s.title,
      meta: s.extractedLocation?.name || s.extractedLocation?.city || getCategoryTile(s.category).label,
      saved: true, onClick: () => onNavigate('save-detail', { id: s._id }),
    }));
  })();

  const subtitle = chip === 'near'
    ? (geo === 'denied' ? 'Turn on location to see what is close' : `Within ${RADIUS_M / 1000} km · ${rows.length} place${rows.length === 1 ? '' : 's'}`)
    : chip === 'foryou' ? (rows.length ? `${rows.length} picked from what you saved` : 'Save a few things and this fills in') : `${rows.length} saved`;

  return (
    <div className="wt-screen has-nav">
      <h1 className="wt-title" style={{ marginBottom: 16 }}>Discover</h1>
      <div className="wt-chips" style={{ marginBottom: 18 }}>
        {CHIPS.map((c) => <Chip key={c.id} on={chip === c.id} onClick={() => setChip(c.id)}>{c.label}</Chip>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)', fontSize: 13, color: 'var(--mute)' }}>
        <span>{subtitle}</span>
        <button type="button" onClick={() => setFilterOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--teal)', fontWeight: 500, background: 'none', border: 0, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}><Icon name="filter" size={14} stroke={2} />{radius !== 5000 || hideSaved || sort !== 'closest' ? 'Filters on' : 'Filter'}</button>
      </div>
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '9px 14px', borderRadius: 10, fontSize: 13.5, zIndex: 70 }}>{toast}</div>}
      {filterOpen && (
        <div className="wt-sheet" onClick={() => setFilterOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 14px' }}>Narrow it down</p>
            <span className="wt-label">How far</span>
            <div className="wt-chips" style={{ marginBottom: 16 }}>{RADII.map((r) => <Chip key={r} small on={radius === r} onClick={() => setRadius(r)}>{r / 1000} km</Chip>)}</div>
            <span className="wt-label">Order</span>
            <div className="wt-chips" style={{ marginBottom: 16 }}>{SORTS.map(([id, label]) => <Chip key={id} small on={sort === id} onClick={() => setSort(id)}>{label}</Chip>)}</div>
            <button type="button" className="wt-menu-row" onClick={() => setHideSaved((v) => !v)} style={{ borderTop: '1px solid var(--line)' }}>
              <Icon name={hideSaved ? 'check' : 'bookmark'} size={20} /><span style={{ flex: 1 }}>Hide what I've already saved</span><span style={{ fontSize: 13, color: 'var(--faint)' }}>{hideSaved ? 'On' : 'Off'}</span>
            </button>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button small variant="secondary" onClick={() => { setRadius(5000); setSort('closest'); setHideSaved(false); }}>Reset</Button>
              <Button small onClick={() => setFilterOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {loading && chip === 'near' ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', fontSize: 14 }}>Finding what's close…</div>
      ) : rows.length === 0 ? (
        chip === 'near' && geo === 'denied'
          ? <EmptyState title="Location is off" text="Explore works from where you are. Allow location to see saves and places nearby." />
          : <EmptyState title="Nothing here yet" text={chip === 'near' ? 'Nothing you saved is within 5 km. Try another chip.' : 'Save something in this category and it shows up here.'} action="Add a save" onAction={() => onNavigate('add-save')} />
      ) : rows.map((r) => (
        <ListRow key={r.key} category={r.category} title={r.title} meta={r.meta} reason={r.reason} trail={r.trail} alignTop
          trailIcon={<span role={r.place ? 'button' : undefined} aria-label={r.place ? (r.saved ? 'Saved' : 'Save') : undefined} onClick={r.place ? (e) => savePlace(e, r.place) : undefined} style={{ display: 'flex', padding: r.place ? 6 : 0, margin: r.place ? -6 : 0, color: r.saved ? 'var(--teal)' : 'var(--ink)', opacity: saving === r.key ? 0.4 : 1 }}><Icon name="bookmark" size={20} fill={r.saved ? 'currentColor' : 'none'} /></span>}
          onClick={r.onClick} />
      ))}
    </div>
  );
}
