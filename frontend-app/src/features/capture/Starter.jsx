import { useState, useEffect } from 'react';
import api from '../../api';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import { getCategoryTile, KIND_HUE } from '../../lib/categoryMeta';
import { formatDistance } from '../../lib/format';

// "Your list has N things on it" — what an import produced, grouped the way the
// auto-collection engine grouped it.
export default function Starter({ onNavigate, payload }) {
  const [saves, setSaves] = useState([]);
  const [collections, setCollections] = useState([]);
  const ids = new Set(payload?.saveIds || []);

  useEffect(() => {
    Promise.all([api.getSaves({ force: true }), api.getCollections().catch(() => null)]).then(([s, c]) => {
      if (s?.status === 'success') setSaves(s.data || []);
      if (c?.status === 'success') setCollections(c.data || []);
    });
  }, []);

  const mine = ids.size ? saves.filter((s) => ids.has(s._id)) : saves;
  const city = JSON.parse(localStorage.getItem('user') || '{}')?.location?.city;
  const inCity = city ? mine.filter((s) => (s.extractedLocation?.city || '').toLowerCase().includes(String(city).toLowerCase().split(' ')[0])).length : 0;

  // Group by collection when the engine made any; otherwise by category kind.
  const groups = (() => {
    const byCol = collections.map((c) => ({ name: c.name, items: mine.filter((s) => (s.collections || []).some((x) => (x._id || x) === c._id)) })).filter((g) => g.items.length);
    if (byCol.length) {
      const placed = new Set(byCol.flatMap((g) => g.items.map((s) => s._id)));
      const rest = mine.filter((s) => !placed.has(s._id));
      return rest.length ? [...byCol, { name: 'Someday', items: rest }] : byCol;
    }
    const kinds = { place: 'Places', food: 'Food', shop: 'Shopping', learn: 'Watch & read', none: 'Saved' };
    return Object.entries(kinds).map(([k, name]) => ({ name, items: mine.filter((s) => getCategoryTile(s.category).kind === k) })).filter((g) => g.items.length);
  })();

  return (
    <div className="wt-screen">
      <span className="wt-eyebrow">Done</span>
      <h1 className="wt-title lg" style={{ margin: '10px 0 8px' }}>Your list has<br />{mine.length} thing{mine.length === 1 ? '' : 's'} on it.</h1>
      <p className="wt-sub" style={{ marginBottom: 22 }}>
        {payload?.failed ? `${payload.failed} couldn't be read. ` : ''}{inCity ? `${inCity} ${inCity === 1 ? 'is' : 'are'} in ${city}. ` : ''}{groups.length > 1 ? `We sorted them into ${groups.length} collections.` : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map((g) => (
          <div key={g.name} style={{ padding: 16, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{g.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{g.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {g.items.slice(0, 3).map((s) => (
                <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => onNavigate('save-detail', { id: s._id })}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: KIND_HUE[getCategoryTile(s.category).kind], flexShrink: 0 }} />
                  <span style={{ fontSize: 14.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{s.distanceMetres != null ? formatDistance(s.distanceMetres) : getCategoryTile(s.category).label}</span>
                </div>
              ))}
              {g.items.length > 3 && <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500, marginTop: 2 }}>and {g.items.length - 3} more</span>}
            </div>
          </div>
        ))}
      </div>

      {groups.length > 1 && <div style={{ marginTop: 22 }}><Banner icon="sparkle">We grouped them into <strong>{groups.slice(0, 3).map((g) => g.name).join('</strong>, <strong>')}</strong>. Change anytime.</Banner></div>}

      <div style={{ marginTop: 'auto', paddingTop: 20 }}>
        <Button onClick={() => onNavigate('saved', { refresh: true })}>See my list</Button>
      </div>
    </div>
  );
}
