import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { relativeTime } from '../../lib/format';

// Completion screen after a save flips to `tried` (ADR 0015): one-tap rating,
// optional note. Rating is the only signal that says a recommendation was good.
const LABELS = ['', 'Not for me', 'Meh', 'Good', 'Really good', 'Would go again'];

export default function Tried({ onNavigate, onBack, payload }) {
  const { id, title, createdAt, triedCount } = payload || {};
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const done = async () => {
    if (!id) return onBack?.();
    setSaving(true);
    try {
      await api.updateIntent(id, { intentStatus: 'tried', rating: rating || null, triedNote: note.trim() || null });
    } finally {
      setSaving(false);
      onNavigate('saved', { tab: 'tried', refresh: true });
    }
  };

  return (
    <div className="wt-screen dark">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
        <button type="button" onClick={onBack} aria-label="Close" style={{ background: 'none', border: 0, color: 'rgba(255,255,255,.75)', cursor: 'pointer' }}><Icon name="close" size={22} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.22)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand)' }}>
          <Icon name="check" size={44} stroke={2.2} />
        </div>
        <span className="wt-eyebrow" style={{ color: 'var(--sand)', marginBottom: 12 }}>Tried it</span>
        <h1 className="wt-title lg" style={{ color: '#fff', marginBottom: 8 }}>{title || 'Done'}</h1>
        {createdAt && <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,.7)' }}>Saved {relativeTime(createdAt).toLowerCase()} · tried today</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 38 }}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,.75)' }}>Worth it?</span>
        <div style={{ display: 'flex', gap: 10 }} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)}
              style={{ width: 46, height: 46, background: 'none', border: 0, cursor: 'pointer', color: i <= rating ? 'var(--sand)' : 'rgba(255,255,255,.45)' }}>
              <Icon name="star" size={34} stroke={1.6} fill={i <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--sand)', minHeight: 20 }}>{LABELS[rating]}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 16px', borderRadius: 12, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', marginTop: 26, color: 'rgba(255,255,255,.6)' }}>
        <Icon name="edit" size={17} stroke={1.9} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for future you"
          style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: '#fff', fontSize: 15 }} />
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {typeof triedCount === 'number' && <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', margin: 0, textAlign: 'center' }}>That's {triedCount + 1} tried.</p>}
        <Button onDark onClick={done} disabled={saving}>{saving ? 'Saving…' : 'Done'}</Button>
      </div>
    </div>
  );
}
