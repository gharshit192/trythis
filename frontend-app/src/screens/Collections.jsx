import { useState, useEffect } from 'react';
import api from '../api';

export default function Collections({ onNavigate }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine'); // 'mine' | 'auto' | 'shared'
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📌');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const fetchCollections = async () => {
    try {
      const result = await api.getCollections();
      if (result.status === 'success') setCollections(result.data);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollections(); }, []);

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
        await fetchCollections();
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
  const totalSaves = collections.reduce((sum, c) => sum + (c.saves?.length || 0), 0);

  return (
    <>
      <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="display" style={{ fontSize: '22px' }}>Collections</h1>
            <div
              role="button"
              aria-label="New collection"
              onClick={() => setShowCreate(true)}
              style={{ width: '34px', height: '34px', background: 'var(--linen)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <i className="ti ti-plus" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--slate)', marginTop: '4px' }}>{collections.length} collections · {totalSaves} saves</p>
        </div>

        <div style={{ display: 'flex', gap: '18px', padding: '0 20px', borderBottom: '0.5px solid var(--hairline)' }}>
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
                  padding: '10px 0',
                  fontSize: '13px',
                  color: active ? 'var(--forest)' : 'var(--slate)',
                  fontWeight: active ? 500 : 400,
                  borderBottom: active ? '2px solid var(--forest)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span style={{ display: 'inline-block', background: active ? 'var(--forest)' : 'var(--dune)', color: active ? 'var(--linen)' : 'var(--slate)', fontSize: '9px', padding: '1px 5px', borderRadius: '6px', marginLeft: '4px', fontWeight: '500', verticalAlign: 'top', marginTop: '-1px' }}>
                    {t.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {tab === 'auto' && autoCollections.length > 0 && (
          <div style={{ margin: '16px 20px 8px', background: 'var(--forest-faint)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-sparkles" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
            <p style={{ fontSize: '12px', color: 'var(--forest)', lineHeight: '1.4' }}>TryThis grouped your saves into {autoCollections.length} collection{autoCollections.length === 1 ? '' : 's'} based on what it spotted.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px 20px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading collections...</p>
          ) : visible.length > 0 ? (
            visible.map(col => (
              <div key={col._id} className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('collection-detail', { id: col._id })}>
                <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dune)', position: 'relative' }}>
                  {col.isAuto && <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255,255,255,0.95)', padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: '500', color: 'var(--forest)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <i className="ti ti-sparkles" style={{ fontSize: '8px' }}></i> Auto
                  </div>}
                  <span style={{ fontSize: '28px' }}>{col.icon || '📁'}</span>
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(14,14,12,0.7)', color: 'var(--linen)', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: '500' }}>{col.saves?.length || 0}</div>
                </div>
                <div style={{ padding: '9px 11px 11px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '500' }}>{col.name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '3px' }}>{col.isAuto ? 'Auto-collected' : 'Collection'}</p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>
              {tab === 'auto' ? 'No auto-collections yet — save a few items and TryThis will group them.' : tab === 'shared' ? 'No shared collections.' : 'No collections yet'}
            </p>
          )}
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
              <h3 className="display" style={{ fontSize: 18, marginBottom: 6 }}>New collection</h3>
              <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 14 }}>Group saves you want to revisit together.</p>

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
                      background: newIcon === ic ? 'var(--forest-faint)' : 'var(--linen)',
                      border: newIcon === ic ? '1px solid var(--forest)' : '0.5px solid var(--hairline)',
                      fontSize: 18, cursor: 'pointer',
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

              {createError && <p style={{ color: 'var(--error,#d33)', fontSize: 13, marginBottom: 8 }}>{createError}</p>}

              <button className="btn-primary" disabled={creating} onClick={handleCreate}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
