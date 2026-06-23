import { useState } from 'react';
import api from '../api';

const demoSaves = [
  {
    id: 1,
    title: 'Third Wave Coffee — Bangalore',
    category: 'cafe',
    badge: 'Specialty coffee · ₹300–500 for two',
    thumbnail: '☕'
  },
  {
    id: 2,
    title: 'Goa 7-Day Budget Backpacking',
    category: 'travel',
    badge: 'Budget travel · 7 days',
    thumbnail: '🗺️'
  },
  {
    id: 3,
    title: 'Sustainable Sneakers Under $100',
    category: 'shopping',
    badge: 'Trending on Instagram',
    thumbnail: '👟'
  }
];

const getCategoryColor = (category) => {
  const map = {
    cafe: { bg: 'rgba(14,124,123,0.1)', color: '#0E7C7B' },
    travel: { bg: 'rgba(0,102,255,0.1)', color: '#0066FF' },
    shopping: { bg: 'rgba(124,34,255,0.1)', color: '#7C22FF' }
  };
  return map[category] || { bg: '#F1EFE8', color: '#5F5E5A' };
};

export default function DemoSaves({ onNavigate }) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSaveUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.createSave({
        url: url.trim(),
        sourceType: 'url'
      });
      if (res.status === 'success') {
        onNavigate('firstSaveSuccess', {
          saveId: res.data._id,
          isFirstSave: true,
          nextScreen: 'notification-permission'
        });
      } else {
        setError(res.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 20 }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', textAlign: 'center', borderBottom: '0.5px solid #eee' }}>
          <h1 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 6px' }}>This is Wanna Try</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>See what we can do with your saves</p>
        </div>

        {/* Demo saves — interactive list */}
        <div style={{ padding: '16px 20px' }}>
          {demoSaves.map((save) => {
            const colors = getCategoryColor(save.category);
            return (
              <div
                key={save.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: '0.5px solid #eee'
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: colors.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 25,
                    flexShrink: 0
                  }}
                >
                  {save.thumbnail}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', marginBottom: 3 }}>
                    {save.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {save.badge}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA section */}
        <div style={{ padding: '20px 20px 0' }}>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#1a1a1a', margin: '0 0 12px' }}>
            Now add your first one
          </p>
          <input
            type="url"
            placeholder="Paste an Instagram link, YouTube video, or any URL…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 15,
              border: '0.5px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              marginBottom: 12
            }}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#d33', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveUrl}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--coral, #0E7C7B)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Saving…' : 'Save this'}
            </button>
            <button
              onClick={() => onNavigate('notification-permission')}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f5f5f5',
                color: '#1a1a1a',
                border: '0.5px solid #ddd',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
