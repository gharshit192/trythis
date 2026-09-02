import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import CategoryTile from '../../components/CategoryTile';

// "This reel has N places in it" — confirm step when one capture yields several
// items. Unticked items are removed; the rest are kept together.
export default function MultiExtract({ onNavigate, onBack, payload }) {
  const items = payload?.items || [];
  const [off, setOff] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const source = payload?.source || '';
  const keep = items.filter((i) => !off.has(i._id));

  const confirm = async () => {
    setSaving(true);
    try {
      await Promise.all(items.filter((i) => off.has(i._id)).map((i) => api.deleteSave(i._id).catch(() => null)));
    } finally {
      setSaving(false);
      onNavigate('saved', { refresh: true });
    }
  };

  return (
    <div className="wt-screen">
      <div className="wt-topbar" style={{ marginBottom: 22 }}>
        <button type="button" className="wt-iconbtn" aria-label="Close" onClick={onBack}><Icon name="close" size={22} /></button>
        {source && <span style={{ fontSize: 13, color: 'var(--faint)' }}>{source}</span>}
      </div>
      <h1 className="wt-title" style={{ marginBottom: 8 }}>This {payload?.kind || 'reel'} has<br />{items.length} place{items.length === 1 ? '' : 's'} in it.</h1>
      <p className="wt-sub" style={{ fontSize: 15, marginBottom: 20 }}>Untick anything you don't want. We'll keep them together.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => {
          const on = !off.has(it._id);
          return (
            <button key={it._id} type="button" onClick={() => setOff((p) => { const n = new Set(p); on ? n.add(it._id) : n.delete(it._id); return n; })}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', borderRadius: 14, background: 'var(--card)', border: on ? '1.5px solid var(--teal)' : '1px solid var(--line)', opacity: on ? 1 : .6, cursor: 'pointer', textAlign: 'left' }}>
              <CategoryTile category={it.category} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span className="wt-row-title" style={{ fontSize: 17 }}>{it.title}</span>
                <span style={{ fontSize: 12.5, color: 'var(--mute)' }}>{[it.extractedLocation?.name || it.extractedLocation?.city, it.aiAnalysis?.structuredData?.place?.priceRange].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--teal)' : 'transparent', border: on ? 0 : '1.5px solid #C9CFCC', color: '#fff' }}>
                {on && <Icon name="check" size={13} stroke={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {payload?.collectionName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '13px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--teal)' }}>
          <Icon name="folder" size={18} />
          <span style={{ fontSize: 14, flex: 1, color: 'var(--ink)' }}>Add to <strong>{payload.collectionName}</strong></span>
          <Icon name="forward" size={16} style={{ color: 'var(--faint)' }} />
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <Button onClick={confirm} disabled={saving || keep.length === 0}>{saving ? 'Saving…' : `Save ${keep.length} place${keep.length === 1 ? '' : 's'}`}</Button>
      </div>
    </div>
  );
}
