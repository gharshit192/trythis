import { useState } from 'react';
import api from '../api';

const CATEGORY_ICONS = {
  'cafe': '☕',
  'cafes': '☕',
  'coffee': '☕',
  'food': '🍽️',
  'restaurant': '🍽️',
  'restaurants': '🍽️',
  'hotel': '🏨',
  'stay': '🏨',
  'stays': '🏨',
  'accommodation': '🏨',
  'activity': '🗺️',
  'activities': '🗺️',
  'place': '📍',
  'places': '📍',
  'shopping': '🛍️',
  'shop': '🛍️',
  'tech': '⚙️',
  'technical': '⚙️',
  'error': '⚙️',
  'gaming': '🎮',
  'console': '🎮',
  'social': '📱',
  'default': '📌'
};

const getCategoryIcon = (categoryName) => {
  if (!categoryName) return CATEGORY_ICONS.default;
  const lower = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return CATEGORY_ICONS.default;
};

export default function ScreenshotSummary({ sessionId, summary: initialSummary, thumbnails = [], saveId = null, autoSaved = false, onNavigate }) {
  const [summary, setSummary] = useState(initialSummary);
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(Boolean(autoSaved || saveId));

  if (!summary) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
        <p>No summary available</p>
        <button onClick={() => onNavigate('home')} style={{ marginTop: 12 }}>Go home</button>
      </div>
    );
  }

  const handleRefine = async () => {
    if (!refineText.trim()) return;
    setLoading(true);
    setLoadingAction('refine');
    setError(null);
    try {
      const result = await api.refineScreenshotBundle(sessionId, refineText);
      setSummary(result.summary);
      setShowRefine(false);
      setRefineText('');
    } catch (err) {
      setError('Refinement failed. Please retry.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    setLoadingAction('regenerate');
    setError(null);
    try {
      const result = await api.refineScreenshotBundle(sessionId, 'Please re-analyze and provide a fresh comprehensive summary');
      setSummary(result.summary);
    } catch (err) {
      setError('Regeneration failed. Please retry.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setLoadingAction('save');
    setError(null);
    try {
      const result = await api.saveScreenshotBundle(sessionId, summary);
      const savedDoc = result?.save || result?.data || null;
      setSaved(true);
      if (savedDoc?._id) {
        setTimeout(() => onNavigate('save-detail', { id: savedDoc._id, refresh: true }), 700);
      } else {
        setTimeout(() => onNavigate('home', { refresh: true }), 700);
      }
    } catch (err) {
      setError('Save failed. Please retry.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleExportPdf = () => {
    try {
      api.exportBundlePdf(sessionId);
    } catch (err) {
      setError('PDF export failed.');
    }
  };

  const handleShareImage = () => {
    if (navigator.share) {
      navigator.share({
        title: summary.autoTitle,
        text: summary.masterSummary?.oneLiner,
      });
    }
  };

  return (
    <div style={{ background: 'var(--colors-surface-surface-0, white)', minHeight: '100vh', paddingBottom: 20 }}>
      {/* Header with back & screenshot count */}
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid var(--colors-stroke-tertiary, #eee)' }}>
        <button
          onClick={() => onNavigate('home')}
          style={{ width: 32, height: 32, background: 'var(--colors-surface-surface-1, #f5f5f5)', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>
          ←
        </button>
        <span style={{ fontSize: 13, color: 'var(--colors-type-tertiary, #888)' }}>
          {summary.totalScreenshots || 0} screenshots
        </span>
        <button
          onClick={handleShareImage}
          style={{ width: 32, height: 32, background: 'var(--colors-surface-surface-1, #f5f5f5)', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>
          ⤴
        </button>
      </div>

      {/* Intro section */}
      <div style={{ padding: '16px 20px 12px' }}>
        <h1 style={{ fontSize: 23, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.3 }}>
          Your screenshot dump,<br/>made sense of
        </h1>
        <p style={{ fontSize: 13, color: 'var(--colors-type-tertiary, #888)', margin: 0 }}>
          Sorted into {summary.categories?.length || 0} groups by Wanna Try · just now
        </p>
      </div>

      {/* AI Detection strip */}
      <div style={{ background: 'linear-gradient(135deg, rgba(46, 107, 82, 0.08) 0%, var(--colors-surface-surface-1, #f5f5f5) 100%)', borderLeft: '2px solid var(--colors-brands-primary-main, #0E7C7B)', borderRadius: '0 12px 12px 0', padding: '10px 12px', margin: '8px 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15 }}>✨</span>
        <p style={{ fontSize: 12, color: 'var(--colors-brands-primary-main, #0E7C7B)', lineHeight: 1.4, margin: 0 }}>
          {summary.masterSummary?.oneLiner || 'AI analysis complete'}
        </p>
      </div>

      {/* Action buttons - visible and accessible */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 20px 12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleRegenerate}
          disabled={loading}
          style={{ flex: '0 0 auto', padding: '8px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'var(--colors-surface-surface-1, #f5f5f5)', border: '0.5px solid var(--colors-stroke-tertiary, #ddd)', opacity: loading ? 0.6 : 1 }}>
          ↺ Regenerate
        </button>
        <button
          onClick={() => setShowRefine(!showRefine)}
          disabled={loading}
          style={{ flex: '0 0 auto', padding: '8px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'var(--colors-surface-surface-1, #f5f5f5)', border: '0.5px solid var(--colors-stroke-tertiary, #ddd)', opacity: loading ? 0.6 : 1 }}>
          ✎ Refine
        </button>
        <button
          onClick={handleExportPdf}
          disabled={loading}
          style={{ flex: '0 0 auto', padding: '8px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'var(--colors-surface-surface-1, #f5f5f5)', border: '0.5px solid var(--colors-stroke-tertiary, #ddd)', opacity: loading ? 0.6 : 1 }}>
          📄 Export PDF
        </button>
        <button
          onClick={handleShareImage}
          style={{ flex: '0 0 auto', padding: '8px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'var(--colors-surface-surface-1, #f5f5f5)', border: '0.5px solid var(--colors-stroke-tertiary, #ddd)' }}>
          📤 Share image
        </button>
      </div>

      {/* Master summary bullets */}
      {summary.masterSummary?.bullets && summary.masterSummary.bullets.length > 0 && (
        <div style={{ background: 'var(--colors-surface-surface, white)', border: '0.5px solid var(--colors-stroke-tertiary, #eee)', borderRadius: 14, padding: '12px 16px', margin: '0 20px 12px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: 'var(--colors-type-primary, #1a1a1a)' }}>KEY POINTS</p>
          {summary.masterSummary.bullets.map((bullet, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--colors-brands-primary-main, #0E7C7B)', fontWeight: 600, flexShrink: 0 }}>•</span>
              <span style={{ color: 'var(--colors-type-primary, #1a1a1a)', lineHeight: 1.4 }}>{bullet}</span>
            </div>
          ))}
        </div>
      )}

      {/* Category groups with bifurcations */}
      <div style={{ paddingBottom: 20 }}>
        {summary.categories?.map((cat, idx) => (
          <div
            key={idx}
            style={{ background: 'var(--colors-surface-surface, white)', border: '0.5px solid var(--colors-stroke-tertiary, #eee)', borderRadius: 14, padding: '12px 16px', margin: '0 20px 10px' }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(46, 107, 82, 0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                {getCategoryIcon(cat.name)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--colors-type-primary, #1a1a1a)' }}>
                  {cat.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--colors-type-tertiary, #888)', margin: 0 }}>
                  {cat.count} items
                </p>
              </div>
            </div>

            {/* Category summary */}
            {cat.summary && (
              <p style={{ fontSize: 12, color: 'var(--colors-type-primary, #1a1a1a)', lineHeight: 1.4, fontStyle: 'italic', margin: '8px 0' }}>
                "{cat.summary}"
              </p>
            )}

            {/* Items list with bifurcations */}
            {cat.items && cat.items.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {cat.items.map((item, ii) => (
                  <div key={ii} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--colors-type-primary, #1a1a1a)' }}>
                      <div style={{ width: 5, height: 5, background: 'var(--colors-brands-primary-main, #0E7C7B)', borderRadius: '50%', flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                        {item.details && (
                          <div style={{ fontSize: 11, color: 'var(--colors-type-tertiary, #888)', marginTop: 2 }}>
                            {item.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ margin: '0 20px 12px', padding: 10, background: 'var(--colors-background-danger, #FEF2F2)', borderRadius: 8, fontSize: 12, color: 'var(--colors-type-danger, #A32D2D)' }}>
          {error}
        </div>
      )}

      {/* Refine input - inline */}
      {showRefine && (
        <div style={{ margin: '0 20px 12px', background: 'var(--colors-surface-surface-1, #f5f5f5)', borderRadius: 12, padding: 12, border: '0.5px solid var(--colors-stroke-tertiary, #eee)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 8px', color: 'var(--colors-type-tertiary, #888)' }}>REFINE WITH INSTRUCTIONS</p>
          <textarea
            value={refineText}
            onChange={e => setRefineText(e.target.value)}
            placeholder='"Focus only on budget options under ₹2000/night"'
            style={{ width: '100%', minHeight: 60, fontSize: 12, padding: 8, borderRadius: 8, border: '0.5px solid var(--colors-stroke-tertiary, #ddd)', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => setShowRefine(false)} style={{ flex: 1, padding: 8, fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--colors-surface-surface, white)', border: '0.5px solid var(--colors-stroke-tertiary, #ddd)' }}>
              Cancel
            </button>
            <button
              onClick={handleRefine}
              disabled={loading || !refineText.trim()}
              style={{ flex: 1, padding: 8, fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--colors-brands-primary-main, #0E7C7B)', color: 'white', border: 'none', opacity: loading ? 0.6 : 1 }}>
              {loading && loadingAction === 'refine' ? 'Refining...' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {/* Save button - bottom */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={loading || saved}
          style={{ flex: 1, padding: '12px 0', background: saved ? 'var(--colors-brands-success-main, #2E6B52)' : 'var(--colors-brands-primary-main, #0E7C7B)', color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {saved ? 'Saved to your screenshots' : loading && loadingAction === 'save' ? 'Saving...' : 'Save to screenshots'}
        </button>
      </div>
    </div>
  );
}
