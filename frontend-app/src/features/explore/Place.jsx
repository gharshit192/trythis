import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import CategoryTile from '../../components/CategoryTile';
import ListRow from '../../components/ListRow';
import SectionLabel from '../../components/SectionLabel';

// A seeded / shared Place (not one of the user's own saves). Text-first, same
// header vocabulary as the item screen; the only action is to go.
export default function Place({ onNavigate, onBack, payload }) {
  const [place, setPlace] = useState(null);
  const [similar, setSimilar] = useState([]);
  const id = payload?.id;

  useEffect(() => {
    if (!id) return;
    api.getPlace(id).then((r) => { if (r?.status === 'success') setPlace(r.data); });
    api.getPlaceSimilar(id).then((r) => { if (r?.status === 'success') setSimilar(r.data || []); }).catch(() => {});
  }, [id]);

  if (!place) return <div className="wt-screen"><div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)' }}>Loading…</div></div>;

  const mapsHref = place.geo?.lat
    ? `https://www.google.com/maps/search/?api=1&query=${place.geo.lat},${place.geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.canonicalName, place.city].filter(Boolean).join(', '))}`;

  return (
    <div className="wt-screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink)' }}><Icon name="back" size={22} /></button>
        <CategoryTile category={place.category} size={36} />
      </div>
      <span className="wt-eyebrow" style={{ marginBottom: 12 }}>{place.category || 'Place'}{place.city ? <span style={{ color: 'var(--faint)', letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}> · {place.city}</span> : null}</span>
      <h1 className="wt-title lg" style={{ marginBottom: 10 }}>{place.canonicalName}</h1>
      {place.saveCount >= 5 && <span style={{ fontSize: 14.5, color: 'var(--mute)', marginBottom: 22 }}>Saved by {place.saveCount} people</span>}

      {place.aggregatedTake?.text && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, marginTop: 8 }}>
          <SectionLabel>The take</SectionLabel>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>{place.aggregatedTake.text}</p>
        </div>
      )}
      {(place.vibeTags || []).length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
          {place.vibeTags.map((t) => <span key={t} className="wt-chip sm" style={{ cursor: 'default' }}>{t}</span>)}
        </div>
      )}
      {similar.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Similar places</SectionLabel>
          {similar.slice(0, 4).map((p) => <ListRow key={p._id} category={p.category} title={p.canonicalName} meta={p.city} onClick={() => onNavigate('place', { id: p._id })} />)}
        </section>
      )}
      <div style={{ marginTop: 'auto' }}>
        <a className="wt-btn sm" href={mapsHref} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Icon name="pin" size={17} stroke={2} />Directions</a>
      </div>
    </div>
  );
}
