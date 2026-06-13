import { useState, useEffect } from 'react';
import api from '../api';
import { getBucketMeta, CATEGORY_FILTERS, getCategoryBucket } from '../categoryMeta';
import SaveCard from '../components/SaveCard';

export default function Collections({ onNavigate }) {
  const [saves, setSaves] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine'); // 'mine' | 'auto' | 'shared'
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📌');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const fetchAll = async () => {
    try {
      const [colResult, savesResult] = await Promise.all([
        api.getCollections(),
        api.getSaves(),
      ]);
      if (colResult.status === 'success') setCollections(colResult.data);
      if (savesResult.status === 'success') {
        setSaves((savesResult.data || []).filter(s => !s.isTemplate));
      }
    } catch (err) {
      console.error('Failed to fetch saves/collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    setCreateError(null);
    const name = newName.trim();
    if (!name) { setCreateError('Name is required.'); return; }
    setCreating(true);
    try {
      const res = await api.createCollection(name, '', newIcon || '📌');
      if (res.status === 'success') {
        setShowCreate(false);
        setNewName('');
        setNewIcon('📌');
        await fetchAll();
      } else {
        setCreateError(res.error?.message || 'Create failed');
      }
    } catch (err) {
      setCreateError(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const autoCollections = collections.filter((c) => c.isAuto);
  const manualCollections = collections.filter((c) => !c.isAuto);
  const visible = tab === 'auto' ? autoCollections : tab === 'shared' ? [] : manualCollections;

  // Category overview rows (S9 sv-cats)
  const bucketCounts = saves.reduce((acc, s) => {
    const bucket = getCategoryBucket(s.category);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
  const browseBuckets = CATEGORY_FILTERS
    .filter((f) => f.id !== 'all')
    .map((f) => ({ id: f.id, meta: getBucketMeta(f.id), count: bucketCounts[f.id] || 0 }))
    .filter((b) => b.count > 0);

  const recentSaves = [...saves]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div className="sv-hdr">
        <span className="sv-title">Your Saves</span>
        <span className="sv-sort">↕</span>
      </div>

      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--mute)', textAlign: 'center', padding: '40px 20px' }}>Loading...</p>
      ) : (
        <>
          <div className="sv-stats">{saves.length} save{saves.length !== 1 ? 's' : ''} · {browseBuckets.length} categor{browseBuckets.length !== 1 ? 'ies' : 'y'}</div>

          {browseBuckets.length > 0 && (
            <div className="sv-cats">
              {browseBuckets.map(({ id, meta, count }) => (
                <div key={id} className="sv-citem" onClick={() => onNavigate('savedList', { filter: id, title: meta.label })}>
                  <div className="sv-caccent" style={{ background: meta.color }}></div>
                  <span className="sv-cico">{meta.emoji}</span>
                  <div className="sv-cinfo">
                    <div className="sv-cname">{meta.label}</div>
                    <div className="sv-ccount">{count} save{count !== 1 ? 's' : ''}</div>
                  </div>
                  <span className="sv-carr">›</span>
                </div>
              ))}
            </div>
          )}

          {recentSaves.length > 0 && (
            <>
              <div className="sv-recent">Recently saved</div>
              <div className="sv-minigrid">
                {recentSaves.map((save) => (
                  <SaveCard key={save._id} save={save} onNavigate={onNavigate} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Your collections */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Your collections</span>
        <div
          role="button"
          aria-label="New collection"
          onClick={() => setShowCreate(true)}
          style={{ width: 28, height: 28, background: 'var(--linen)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 15, color: 'var(--coral)' }}></i>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '8px 20px 0', borderBottom: '0.5px solid var(--hairline)' }}>
        {[
          { key: 'mine',   label: 'Mine',   count: manualCollections.length },
          { key: 'auto',   label: 'Auto',   count: autoCollections.length },
          { key: 'shared', label: 'Shared', count: 0 },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <div
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 0',
                fontSize: 13,
                color: active ? 'var(--coral)' : 'var(--slate)',
                fontWeight: active ? 700 : 500,
                borderBottom: active ? '2px solid var(--coral)' : 'none',
                cursor: 'pointer',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{ display: 'inline-block', background: active ? 'var(--coral)' : 'var(--dune)', color: active ? 'var(--linen)' : 'var(--slate)', fontSize: 10, padding: '1px 5px', borderRadius: 6, marginLeft: 4, fontWeight: 500, verticalAlign: 'top', marginTop: -1 }}>
                  {t.count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {tab === 'auto' && autoCollections.length > 0 && (
        <div style={{ margin: '14px 20px 0', background: 'var(--coral-faint)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 17, color: 'var(--coral)' }}></i>
          <p style={{ fontSize: 13, color: 'var(--coral)', lineHeight: 1.4 }}>Wanna Try grouped your saves into {autoCollections.length} collection{autoCollections.length === 1 ? '' : 's'} based on what it spotted.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '12px 20px 20px' }}>
        {!loading && visible.length > 0 ? (
          visible.map(col => (
            <div key={col._id} className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('collection-detail', { id: col._id })}>
              <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dune)', position: 'relative' }}>
                {col.isAuto && <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,0.95)', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i className="ti ti-sparkles" style={{ fontSize: 9 }}></i> Auto
                </div>}
                <span style={{ fontSize: 28 }}>{col.icon || '📁'}</span>
                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(14,14,12,0.7)', color: 'var(--linen)', fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 500 }}>{col.saves?.length || 0}</div>
              </div>
              <div style={{ padding: '9px 11px 11px' }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{col.name}</p>
                <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 3 }}>{col.isAuto ? 'Auto-collected' : 'Collection'}</p>
              </div>
            </div>
          ))
        ) : !loading ? (
          <p style={{ fontSize: 14, color: 'var(--mute)', gridColumn: '1 / -1', textAlign: 'center' }}>
            {tab === 'auto' ? 'No auto-collections yet — save a few items and Wanna Try will group them.' : tab === 'shared' ? 'No shared collections.' : 'No collections yet'}
          </p>
        ) : null}
      </div>

      {showCreate && (
        <div
          onClick={() => !creating && setShowCreate(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--paper)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          >
            <h3 className="display" style={{ fontSize: 19, marginBottom: 6 }}>New collection</h3>
            <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>Group saves you want to revisit together.</p>

            <p className="label">Icon</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {['📌','📁','🍳','🛍️','✈️','🎟️','📰','📋','📍','💡','🏠','🎨'].map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewIcon(ic)}
                  disabled={creating}
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: newIcon === ic ? 'var(--coral-faint)' : 'var(--linen)',
                    border: newIcon === ic ? '1px solid var(--coral)' : '0.5px solid var(--hairline)',
                    fontSize: 19, cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>

            <p className="label">Name</p>
            <input
              type="text"
              className="input"
              placeholder="e.g. Goa Trip"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              autoFocus
              style={{ marginBottom: 12 }}
            />

            {createError && <p style={{ color: 'var(--error,#d33)', fontSize: 14, marginBottom: 8 }}>{createError}</p>}

            <button className="btn-primary" disabled={creating} onClick={handleCreate}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
