import { useState } from 'react';
import api from '../api';

const detectType = (url) => {
  if (!url) return 'screenshot';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'url';
};

export default function AddSave({ onNavigate }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setError(null);
    if (!url.trim() && !title.trim()) {
      setError('Add a link or a title.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createSave({
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
        sourceType: detectType(url.trim()),
      });
      if (res.status === 'success') {
        onNavigate('home');
      } else {
        setError(res.error?.message || 'Save failed');
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'rgba(14,14,12,0.45)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ background: 'var(--paper)', borderRadius: '24px 24px 0 0', padding: '16px 20px 32px' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--hairline)', borderRadius: '2px', margin: '0 auto 18px' }}></div>

          <h2 className="display" style={{ fontSize: '20px', marginBottom: '4px' }}>Add a save</h2>
          <p style={{ fontSize: '13px', color: 'var(--slate)', marginBottom: '16px' }}>Paste it, snap it, or share from any app.</p>

          <p className="label">Link (Instagram, YouTube, any URL)</p>
          <input
            type="url"
            className="input"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ marginBottom: 12 }}
            disabled={saving}
          />

          <p className="label">Title</p>
          <input
            type="text"
            className="input"
            placeholder="Optional if you supply a link"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ marginBottom: 12 }}
            disabled={saving}
          />

          <p className="label">Notes</p>
          <textarea
            className="input"
            placeholder="Why are you saving this?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minHeight: 80, marginBottom: 12, resize: 'vertical' }}
            disabled={saving}
          />

          {error && <p style={{ color: 'var(--error,#d33)', fontSize: 13, marginBottom: 8 }}>{error}</p>}

          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save & Extract'}
          </button>
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => onNavigate('home')} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
