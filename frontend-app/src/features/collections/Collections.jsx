import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';

// Collections: yours and the ones the engine made. Arriving with `addSaveId`
// turns every row into "put this save here".
export default function Collections({ onNavigate, onBack, payload }) {
  const [cols, setCols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const addId = payload?.addSaveId || null;

  const countOf = (c) => c.metadata?.itemCount ?? (c.saves || []).length;
  // Fullest first — the collections you actually use sit at the top.
  const load = () => api.getCollections().then((r) => { if (r?.status === 'success') setCols([...(r.data || [])].sort((a, b) => countOf(b) - countOf(a))); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim()) return;
    const r = await api.createCollection(name.trim(), '', '', '#0E7C7B');
    if (r?.status === 'success') { setName(''); setCreating(false); if (addId) await api.addSaveToCollection(r.data._id, addId).catch(() => {}); load(); }
  };
  const open = async (c) => {
    if (addId) { await api.addSaveToCollection(c._id, addId).catch(() => {}); return onNavigate('save-detail', { id: addId, refresh: true }); }
    onNavigate('collection-detail', { id: c._id });
  };

  return (
    <div className="wt-screen has-nav">
      <div className="wt-topbar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
          <h1 className="wt-title" style={{ fontSize: 28 }}>{addId ? 'Add to…' : 'Collections'}</h1>
        </div>
        <span className="wt-link" style={{ fontSize: 13.5, fontWeight: 500 }} onClick={() => setCreating((v) => !v)}>New</span>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="wt-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Collection name" style={{ height: 48 }} />
          <Button small onClick={create} disabled={!name.trim()} style={{ width: 'auto', padding: '0 16px', height: 48 }}>Add</Button>
        </div>
      )}

      {!loading && cols.length === 0 && <EmptyState title="No collections yet" text="Group saves by trip, city, mood — or let the engine do it as you save." action="Make one" onAction={() => setCreating(true)} />}

      {cols.map((c) => {
        const n = countOf(c);
        return (
          <button key={c._id} type="button" className="wt-row" onClick={() => open(c)}>
            <span className="wt-tile place" style={{ background: c.isAuto ? 'var(--cat-learn-soft)' : undefined, color: c.isAuto ? 'var(--cat-learn)' : undefined }}><Icon name={c.isAuto ? 'sparkle' : 'folder'} size={20} /></span>
            <div className="wt-row-body">
              <span className="wt-row-title">{c.name}</span>
              <span className="wt-row-meta">{n} save{n === 1 ? '' : 's'}{c.isAuto ? ' · made for you' : ''}</span>
            </div>
            <div className="wt-row-trail"><Icon name={addId ? 'plus' : 'forward'} size={18} style={{ color: 'var(--faint)' }} /></div>
          </button>
        );
      })}
    </div>
  );
}
