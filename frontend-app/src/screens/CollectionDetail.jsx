import { useEffect, useState } from 'react';
import api from '../api';

export default function CollectionDetail({ onNavigate, payload }) {
  const id = payload?.id;
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const res = await api.getCollectionById(id);
        if (!active) return;
        if (res.status !== 'success') throw new Error(res.error?.message || 'Failed');
        setCollection(res.data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const handleRemove = async (saveId) => {
    if (!window.confirm('Remove this save from the collection?')) return;
    const res = await api.removeSaveFromCollection(id, saveId);
    if (res.status === 'success') setCollection(res.data);
  };

  if (!id) {
    return (
      <div className="phone-frame">
        <div style={{ background: 'var(--paper)', flex: 1, padding: 20 }}>
          <p>No collection selected.</p>
          <button className="btn-primary" onClick={() => onNavigate('collections')}>Back</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="phone-frame"><div style={{ padding: 32, textAlign: 'center' }}>Loading…</div></div>;
  if (error) return <div className="phone-frame"><div style={{ padding: 32, color: 'var(--error,#d33)' }}>{error}</div></div>;

  const saves = collection?.saves || [];

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('collections')}></i>
          <h1 className="display" style={{ fontSize: '18px' }}>{collection?.name || 'Collection'}</h1>
          <span style={{ width: 20 }} />
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--forest-soft) 0%, var(--forest) 100%)', borderRadius: '12px', height: '120px', margin: '12px 20px 16px', display: 'flex', alignItems: 'flex-end', padding: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500' }}>{collection?.name}</p>
            <p style={{ fontSize: '12px', opacity: 0.8 }}>{saves.length} items saved</p>
          </div>
        </div>
        <div style={{ padding: '0 20px 80px' }}>
          {saves.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--slate)', padding: 24 }}>No saves in this collection yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {saves.map((s) => (
                <div key={s._id || s} className="card" style={{ position: 'relative' }}>
                  <div style={{ height: '80px', background: 'var(--dune)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                       onClick={() => onNavigate('save-detail', { id: s._id || s })}>
                    {s.image ? <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ti ti-bookmark" style={{ fontSize: 24, color: 'var(--forest)' }}></i>}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '500' }}>{s.title || 'Save'}</p>
                    <button onClick={() => handleRemove(s._id || s)} style={{ background: 'transparent', border: 'none', color: 'var(--error,#d33)', cursor: 'pointer', fontSize: 11, padding: 0, marginTop: 4 }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
