import { useEffect, useState } from 'react';
import api from '../api';

export default function CollectionDetail({ onNavigate, payload }) {
  const id = payload?.id;
  const backTo = payload?.from || 'collections';
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

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

  const openEdit = () => {
    setEditName(collection?.name || '');
    setEditIcon(collection?.icon || '📌');
    setEditDesc(collection?.description || '');
    setEditError(null);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    const name = editName.trim();
    if (!name) { setEditError('Name is required.'); return; }
    setSaving(true);
    setEditError(null);
    try {
      const res = await api.updateCollection(id, { name, icon: editIcon, description: editDesc.trim() });
      if (res.status === 'success') {
        setCollection(res.data);
        setShowEdit(false);
      } else {
        setEditError(res.error?.message || 'Update failed');
      }
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this collection? Saves inside won\'t be deleted.')) return;
    const res = await api.deleteCollection(id);
    if (res.status === 'success') onNavigate('collections');
  };

  if (!id) {
    return (
      <div className="phone-frame">
        <div style={{ background: 'var(--paper)', flex: 1, padding: 20 }}>
          <p>No collection selected.</p>
          <button className="btn-primary" onClick={() => onNavigate(backTo)}>Back</button>
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
          <i className="ti ti-arrow-left" style={{ fontSize: '21px', cursor: 'pointer' }} onClick={() => onNavigate(backTo)}></i>
          <h1 className="display" style={{ fontSize: '19px' }}>{collection?.name || 'Collection'}</h1>
          {!collection?.isAuto && (
            <i className="ti ti-pencil" style={{ fontSize: '19px', cursor: 'pointer', color: 'var(--coral)' }} onClick={openEdit}></i>
          )}
          {collection?.isAuto && <span style={{ width: 20 }} />}
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--coral-soft) 0%, var(--coral) 100%)', borderRadius: '12px', height: '120px', margin: '12px 20px 16px', display: 'flex', alignItems: 'flex-end', padding: '16px' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '500' }}>{collection?.name}</p>
            <p style={{ fontSize: '13px', opacity: 0.8 }}>{saves.length} items saved</p>
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
                    {s.image ? <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ti ti-bookmark" style={{ fontSize: 25, color: 'var(--coral)' }}></i>}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>{s.title || 'Save'}</p>
                    <button onClick={() => handleRemove(s._id || s)} style={{ background: 'transparent', border: 'none', color: 'var(--error,#d33)', cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4 }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showEdit && (
          <div
            onClick={() => !saving && setShowEdit(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--paper)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <h3 className="display" style={{ fontSize: 19, marginBottom: 6 }}>Edit collection</h3>
              <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>Update name, icon, or description.</p>

              <p className="label">Icon</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {['📌','📁','🍳','🛍️','✈️','🎟️','📰','📋','📍','💡','🏠','🎨'].map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setEditIcon(ic)}
                    disabled={saving}
                    style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: editIcon === ic ? 'var(--coral-faint)' : 'var(--linen)',
                      border: editIcon === ic ? '1px solid var(--coral)' : '0.5px solid var(--hairline)',
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
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={saving}
                autoFocus
                style={{ marginBottom: 12 }}
              />

              <p className="label">Description</p>
              <input
                type="text"
                className="input"
                placeholder="Optional description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                disabled={saving}
                style={{ marginBottom: 12 }}
              />

              {editError && <p style={{ color: 'var(--error,#d33)', fontSize: 14, marginBottom: 8 }}>{editError}</p>}

              <button className="btn-primary" disabled={saving} onClick={handleSaveEdit}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setShowEdit(false)} disabled={saving}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ width: '100%', marginTop: 16, padding: '10px', background: 'transparent', border: '1px solid var(--error,#d33)', borderRadius: 10, color: 'var(--error,#d33)', fontSize: 14, cursor: 'pointer' }}
              >
                Delete collection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
