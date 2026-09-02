import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import ListRow from '../../components/ListRow';
import EmptyState from '../../components/EmptyState';
import { getCategoryTile } from '../../lib/categoryMeta';

export default function CollectionDetail({ onNavigate, onBack, payload }) {
  const id = payload?.id;
  const [col, setCol] = useState(null);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const load = () => id && api.getCollectionById(id).then((r) => { if (r?.status === 'success') { setCol(r.data); setName(r.data.name); } });
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rename = async () => { setEditing(false); if (name.trim() && name !== col.name) { const r = await api.updateCollection(id, { name: name.trim() }); if (r?.status === 'success') setCol(r.data); } };
  const remove = async () => { const r = await api.deleteCollection(id); if (r?.status === 'success') onNavigate('collections'); };
  const drop = async (saveId) => { setCol((c) => ({ ...c, saves: c.saves.filter((s) => (s._id || s) !== saveId) })); api.removeSaveFromCollection(id, saveId).catch(load); };

  if (!col) return <div className="wt-screen"><div className="wt-topbar"><button type="button" className="wt-iconbtn" onClick={onBack} aria-label="Back"><Icon name="back" size={22} /></button></div></div>;
  const saves = (col.saves || []).filter((s) => s && s.title);

  return (
    <div className="wt-screen">
      {menu && (
        <div className="wt-sheet" onClick={() => setMenu(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <button type="button" className="wt-menu-row" onClick={() => { setMenu(false); setEditing(true); }}><Icon name="edit" size={20} />Rename</button>
            <button type="button" className="wt-menu-row danger" onClick={remove}><Icon name="close" size={20} />Delete collection</button>
          </div>
        </div>
      )}
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <button type="button" className="wt-iconbtn" aria-label="More" onClick={() => setMenu(true)}><Icon name="more" size={21} /></button>
      </div>
      <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em', color: col.isAuto ? 'var(--cat-learn)' : 'var(--teal)' }}>{col.isAuto ? 'Made for you' : 'Collection'}</span>
      {editing
        ? <input className="wt-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && rename()} style={{ fontFamily: 'var(--font-display)', fontSize: 28, height: 56, margin: '8px 0 6px' }} />
        : <h1 className="wt-title" style={{ margin: '8px 0 6px' }}>{col.name}</h1>}
      <span style={{ fontSize: 14, color: 'var(--mute)', marginBottom: 14 }}>{saves.length} save{saves.length === 1 ? '' : 's'}</span>

      {saves.length === 0 && <EmptyState title="Empty so far" text="Open any save and use the folder button to put it here." />}
      {saves.map((s) => (
        <ListRow key={s._id} category={s.category} title={s.title} meta={[getCategoryTile(s.category).label, s.extractedLocation?.city].filter(Boolean).join(' · ')}
          trailIcon={<button type="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); drop(s._id); }} style={{ background: 'none', border: 0, color: 'var(--faint)', cursor: 'pointer' }}><Icon name="close" size={16} /></button>}
          onClick={() => onNavigate('save-detail', { id: s._id })} />
      ))}
      {col.isAuto === false && saves.length > 0 && <div style={{ marginTop: 'auto', paddingTop: 16 }}><Button small variant="secondary" onClick={() => onNavigate('add-save')}>Add a save</Button></div>}
    </div>
  );
}
