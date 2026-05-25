import { useState } from 'react';
import api from '../api';

const CATEGORY_COLORS = {
  travel: { bg: '#EBF4FF', text: '#185FA5', emoji: '✈️' },
  food: { bg: '#EAF3DE', text: '#3B6D11', emoji: '🍽️' },
  shopping: { bg: '#FAEEDA', text: '#854F0B', emoji: '🛍️' },
  hotel: { bg: '#F5F3FF', text: '#534AB7', emoji: '🏨' },
  mixed: { bg: '#F1F0EC', text: '#5F5E5A', emoji: '📌' },
  default: { bg: '#F1EFE8', text: '#5F5E5A', emoji: '📌' }
};

export default function ScreenshotSummary({ sessionId, summary: initialSummary, thumbnails = [], onNavigate }) {
  const [summary, setSummary] = useState(initialSummary);
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

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
      await api.saveScreenshotBundle(sessionId, summary);
      setSaved(true);
      setTimeout(() => onNavigate('home'), 1500);
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

  const colorForCategory = (catName) => {
    return CATEGORY_COLORS[catName?.toLowerCase()] || CATEGORY_COLORS.default;
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 140 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 8px', borderBottom: '0.5px solid #eee' }}>
        <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', fontSize: 14, color: '#666', cursor: 'pointer', marginBottom: 12, padding: 0 }}>
          ← Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 8px' }}>{summary.autoTitle}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {summary.categories?.map(cat => {
            const color = colorForCategory(cat.name);
            return (
              <span key={cat.name} style={{ background: color.bg, color: color.text, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 999 }}>
                {color.emoji} {cat.count} {cat.name}
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{summary.totalScreenshots} screenshots analysed</p>
      </div>

      {/* Thumbnail strip */}
      {thumbnails.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px', overflowX: 'auto', borderBottom: '0.5px solid #eee' }}>
          {thumbnails.map((t, i) => (
            <img key={i} src={t} alt="" style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* Master summary card */}
      <div style={{ margin: '12px 20px', background: '#F8F9FA', borderRadius: 12, padding: 16, border: '0.5px solid #eee' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 10px', color: '#1a1a1a' }}>AI Summary</h2>
        {summary.masterSummary?.oneLiner && (
          <p style={{ fontSize: 13, color: '#444', margin: '0 0 12px', lineHeight: 1.5 }}>{summary.masterSummary.oneLiner}</p>
        )}
        {summary.masterSummary?.bullets?.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#2E6B52', fontWeight: 500, flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
        {summary.masterSummary?.budgetRange && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
            <strong>Budget:</strong> {summary.masterSummary.budgetRange}
          </div>
        )}
        {summary.masterSummary?.bestPick && (
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            <strong>Top pick:</strong> {summary.masterSummary.bestPick}
          </div>
        )}
      </div>

      {/* Category sections */}
      {summary.categories?.map((cat, ci) => {
        const color = colorForCategory(cat.name);
        return (
          <div key={ci} style={{ margin: '0 20px 8px', border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedCategory(expandedCategory === ci ? null : ci)}
              style={{ width: '100%', background: 'white', border: 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 18, marginRight: 10 }}>{color.emoji}</span>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 500, fontSize: 14, color: '#1a1a1a' }}>{cat.name}</span>
              <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>{cat.count}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{expandedCategory === ci ? '▲' : '▼'}</span>
            </button>
            {expandedCategory === ci && cat.items?.map((item, ii) => (
              <div key={ii} style={{ padding: '10px 16px', borderTop: '0.5px solid #f0f0f0', background: '#FAFAFA' }}>
                {item.name && <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: '#1a1a1a' }}>{item.name}</div>}
                {item.details && <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 4 }}>{item.details}</div>}
                {item.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {item.tags.map((t, ti) => (
                      <span key={ti} style={{ fontSize: 10, background: '#F0F0F0', color: '#666', padding: '2px 8px', borderRadius: 999 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Error message */}
      {error && (
        <div style={{ margin: '8px 20px', padding: 12, background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#A32D2D' }}>
          {error}
        </div>
      )}

      {/* Refine sheet */}
      {showRefine && (
        <div style={{ margin: '8px 20px', background: '#F8F9FA', borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 8px', color: '#1a1a1a' }}>Refine summary</p>
          <textarea
            value={refineText}
            onChange={e => setRefineText(e.target.value)}
            placeholder="e.g. Focus only on budget cafes under ₹500 for two"
            style={{ width: '100%', minHeight: 80, fontSize: 13, padding: 10, borderRadius: 8, border: '0.5px solid #ddd', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowRefine(false)} style={{ flex: 1, padding: 10, fontSize: 13, borderRadius: 8, cursor: 'pointer', background: '#f0f0f0', border: 'none' }}>
              Cancel
            </button>
            <button
              onClick={handleRefine}
              disabled={loading || !refineText.trim()}
              style={{ flex: 2, padding: 10, fontSize: 13, borderRadius: 8, cursor: 'pointer', background: '#1B3A2F', color: 'white', border: 'none', opacity: loading ? 0.7 : 1 }}>
              {loading && loadingAction === 'refine' ? 'AI is refining...' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {/* Action bar — fixed bottom */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '0.5px solid #eee', padding: '12px 20px', display: 'flex', gap: 8, maxWidth: 480, margin: '0 auto' }}>
        <button onClick={handleRegenerate} disabled={loading} style={{ flex: 1, padding: '10px 0', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: '#f5f5f5', border: 'none', opacity: loading ? 0.6 : 1 }}>
          {loading && loadingAction === 'regenerate' ? '...' : '↺ Redo'}
        </button>
        <button onClick={() => setShowRefine(!showRefine)} disabled={loading} style={{ flex: 1, padding: '10px 0', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: '#f5f5f5', border: 'none', opacity: loading ? 0.6 : 1 }}>
          ✎ Refine
        </button>
        <button onClick={handleExportPdf} style={{ flex: 1, padding: '10px 0', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: '#f5f5f5', border: 'none' }}>
          ↓ PDF
        </button>
        <button
          onClick={handleSave}
          disabled={loading || saved}
          style={{ flex: 1.5, padding: '10px 0', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: saved ? '#2E6B52' : '#1B3A2F', color: 'white', border: 'none', opacity: loading ? 0.7 : 1 }}>
          {saved ? '✓ Saved' : loading && loadingAction === 'save' ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
