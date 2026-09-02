import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Chip from '../../components/Chip';
import ListRow from '../../components/ListRow';
import EmptyState from '../../components/EmptyState';
import { formatDistance, distanceMetres } from '../../lib/format';
import { getCategoryTile } from '../../lib/categoryMeta';

// Explore replaces the Nearby tab (ADR 0015). One screen, every category; the
// chips are filters over three real sources — your saves, seeded places, and
// (gated) other people's saves. Every row says which (ADR 0014).
const RADIUS_M = 5000;
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
      try {
        const [mine, seeded] = await Promise.all([
          api.getNearbySaves(lat, lng, RADIUS_M),
          api.getNearbyPlaces(lat, lng, RADIUS_M).catch(() => null),
        ]);
        if (mine?.status === 'success') setNear(mine.saves || []);
        if (seeded?.status === 'success') {
          // /places/nearby returns a bounding box without distances; measure here so
          // seeded rows sort and read like the user's own.
          setPlaces((seeded.data || seeded.places || [])
            .map((p) => ({ ...p, distanceMetres: p.geo?.lat != null ? Math.round(distanceMetres(lat, lng, p.geo.lat, p.geo.lng)) : null }))
            .sort((a, b) => (a.distanceMetres ?? 1e9) - (b.distanceMetres ?? 1e9)));
        }
        setGeo('ok');
      } finally { setLoading(false); }
    }, () => { setGeo('denied'); setLoading(false); }, { timeout: 10000, maximumAge: 300000 });
  }, []);

  const mineIds = new Set(near.map((s) => s._id));
  const rows = (() => {
    if (chip === 'near') {
      const own = near.map((s) => ({
        key: s._id, category: s.category, title: s.title,
        meta: s.extractedLocation?.name || s.extractedLocation?.city,
        reason: 'You saved this', trail: formatDistance(s.distanceMetres), saved: true,
        onClick: () => onNavigate('save-detail', { id: s._id }),
      }));
      const seeded = places.filter((p) => !mineIds.has(p._id)).map((p) => ({
        key: p._id, category: p.category, title: p.canonicalName,
        meta: [p.city, ...(p.vibeTags || []).slice(0, 2)].filter(Boolean).join(' · '),
        reason: p.saveCount >= 5 ? `Saved by ${p.saveCount} people` : p.aggregatedTake?.text ? p.aggregatedTake.text.split(/[;.]/)[0].slice(0, 70) : 'Worth a look in your city',
        trail: p.distanceMetres != null ? formatDistance(p.distanceMetres) : undefined, saved: false,
        onClick: () => onNavigate('place', { id: p._id }),
      }));
      return [...own, ...seeded];
    }
    if (chip === 'foryou') {
      return forYou.slice(0, 20).map((s) => ({
        key: s._id, category: s.category, title: s.title,
        meta: s.isPlace ? [s.city, ...(s.vibeTags || []).slice(0, 2)].filter(Boolean).join(' · ') : (s.extractedLocation?.name || s.extractedLocation?.city || getCategoryTile(s.category).label),
        reason: s.isPlace ? (s.saveCount > 1 ? `Saved by ${s.saveCount} people` : 'Saved by someone on Wanna Try') : `Because you saved ${s.because}`,
        saved: !s.isPlace, onClick: () => onNavigate(s.isPlace ? 'place' : 'save-detail', { id: s._id }),
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
      <h1 className="wt-title" style={{ marginBottom: 16 }}>Explore</h1>
      <div className="wt-chips" style={{ marginBottom: 18 }}>
        {CHIPS.map((c) => <Chip key={c.id} on={chip === c.id} onClick={() => setChip(c.id)}>{c.label}</Chip>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)', fontSize: 13, color: 'var(--mute)' }}>
        <span>{subtitle}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--teal)', fontWeight: 500 }}><Icon name="filter" size={14} stroke={2} />Filter</span>
      </div>

      {loading && chip === 'near' ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', fontSize: 14 }}>Finding what's close…</div>
      ) : rows.length === 0 ? (
        chip === 'near' && geo === 'denied'
          ? <EmptyState title="Location is off" text="Explore works from where you are. Allow location to see saves and places nearby." />
          : <EmptyState title="Nothing here yet" text={chip === 'near' ? 'Nothing you saved is within 5 km. Try another chip.' : 'Save something in this category and it shows up here.'} action="Add a save" onAction={() => onNavigate('add-save')} />
      ) : rows.map((r) => (
        <ListRow key={r.key} category={r.category} title={r.title} meta={r.meta} reason={r.reason} trail={r.trail} alignTop
          trailIcon={<Icon name="bookmark" size={20} fill={r.saved ? 'currentColor' : 'none'} style={{ color: r.saved ? 'var(--teal)' : 'var(--ink)' }} />}
          onClick={r.onClick} />
      ))}
    </div>
  );
}
