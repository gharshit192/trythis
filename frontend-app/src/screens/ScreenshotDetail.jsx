import { useEffect, useState } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';

const T = {
  bg: 'var(--paper)',
  bgInner: 'var(--coral-faint)',
  border: 'var(--hairline)',
  text: 'var(--ink)',
  textMuted: 'var(--slate)',
  textFaint: 'var(--mute)',
  greenBg: 'rgba(70,176,118,0.16)',
  greenFg: '#46b076',
  redBg: 'rgba(211,51,51,0.10)',
  redFg: '#e36a6a',
};

const CATEGORY_META = {
  food: { icon: '🍴', label: 'Food', accent: '#46b076' },
  travel: { icon: '🛣', label: 'Travel', accent: '#5a9cd6' },
  shopping: { icon: '🛍', label: 'Shopping', accent: '#a374e0' },
  experience: { icon: '🎫', label: 'Experience', accent: '#d65a8a' },
  blog: { icon: '📰', label: 'Blog', accent: '#9aa5b3' },
  tech: { icon: '💻', label: 'Tech', accent: '#3ec1c9' },
  fashion: { icon: '👗', label: 'Fashion', accent: '#e07ec1' },
  beauty: { icon: '💄', label: 'Beauty', accent: '#f08aae' },
  other: { icon: '📌', label: 'Other', accent: '#9a9a93' },
  general: { icon: '📌', label: 'General', accent: '#9a9a93' },
};
const catMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.other;

export default function ScreenshotDetail({ save, onNavigate }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [toast, setToast] = useState(null);
  // Only ever read here — a combined document arrives with this already
  // computed. Building one is the Documents tab's job.
  const [aggregateData, setAggregateData] = useState(save?.aiAnalysis?.aggregateAnalysis || null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!save?._id) return;

    // Load any previously-saved aggregate analysis (so it doesn't reset/re-run on revisit)
    setAggregateData(save?.aiAnalysis?.aggregateAnalysis || null);

    // Every other image the user owns used to be fetched here to fill a
    // "Related Screenshots" strip and an aggregate picker. Both are gone: being
    // an image is not a relationship, and choosing what to combine now happens
    // in Saves → Documents. Dropping the call also spares this screen a full
    // getSaves() on every open.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?._id]);

  const handleDelete = async () => {
    if (!save?._id) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await api.deleteSave(save._id);
      if (res.status === 'success') {
        setConfirmDelete(false);
        onNavigate('home', { refresh: true });
      } else {
        setDeleteError(res.error?.message || 'Delete failed');
      }
    } catch (err) {
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    setShowShareSheet(true);
    setShareError(null);
    if (save?.shareId) return;

    setShareLoading(true);
    try {
      const res = await api.shareSave(save._id);
      if (res.status === 'success') {
        // Note: save object is read-only here, show shareId from response
        setShareError(null);
      } else {
        setShareError(res.error?.message || 'Failed to create share link');
      }
    } catch (err) {
      setShareError(err.message || 'Failed to create share link');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!save?.shareId) return;
    const shareUrl = `${window.location.origin}/s/${save.shareId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Link copied!');
      setShowShareSheet(false);
    }).catch(() => {
      showToast('Failed to copy');
    });
  };

  const handleExportPdf = async () => {
    if (!save?._id) return;
    try {
      await api.exportScreenshotPdf(save._id);
      showToast('PDF exported');
    } catch (err) {
      showToast('Failed to export PDF');
    }
  };

  const meta = catMeta(save?.category);
  const safeTitle = save?.title || 'Untitled screenshot';
  const safeSummary = save?.aiAnalysis?.summary || save?.description || '';
  const keyPoints = save?.aiAnalysis?.keyPoints || [];
  const structuredData = save?.aiAnalysis?.structuredData || {};

  return (
    <div className="phone-frame" style={{ background: T.bg, color: T.text, minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 112 }}>
        {/* Hero section with overlays */}
        <div
          style={{
            borderRadius: 0,
            marginBottom: 0,
            overflow: 'hidden',
            background: (save?.thumbnail || save?.image) ? 'var(--linen)' : 'linear-gradient(135deg, var(--coral-faint), var(--paper))',
            aspectRatio: '16 / 11',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {save?.thumbnail || save?.image ? (
            <SmartImage
              saveId={save._id}
              src={save.thumbnail || save.image}
              alt={safeTitle}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: T.text, padding: 18 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: T.bg, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: 'var(--coral)' }}>
                <i className="ti ti-file-text" style={{ fontSize: 26 }}></i>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Summary document</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {save?.aiAnalysis?.screenshotAnalysis?.data?.totalScreenshots || save?.metadata?.screenshotCount || 0} images
              </div>
            </div>
          )}

          {/* Top overlay with controls */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '14px 14px',
            }}
          >
            <button
              onClick={() => onNavigate('home')}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: 0,
                color: '#fff',
                fontSize: 19,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ←
            </button>
          </div>

          {/* Bottom overlay with category badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '14px 14px',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.95)',
                color: T.text,
                padding: '5px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {meta.icon} {meta.label}
            </span>
          </div>
        </div>

        {/* Content section */}
        <div style={{ flex: 1, padding: '20px 20px 28px', overflowY: 'auto' }}>
          {/* Title */}
          <h1
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginBottom: 12,
              color: T.text,
              lineHeight: 1.3,
            }}
          >
            {safeTitle}
          </h1>

          {/* Summary */}
          {safeSummary && (
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: T.textMuted,
                marginBottom: 16,
              }}
            >
              {safeSummary}
            </p>
          )}

          {/* Meta chips (update time, processing stage) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {save?.updatedAt && (
              <span
                style={{
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 12,
                  background: T.bgInner,
                  color: T.textMuted,
                }}
              >
                {new Date(save.updatedAt).toLocaleDateString()}
              </span>
            )}
            {save?.processingStages?.metadata?.completed && (
              <span
                style={{
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 12,
                  background: T.greenBg,
                  color: T.greenFg,
                }}
              >
                ✓ Processed
              </span>
            )}
          </div>

          {/* Structured data (if available) */}
          {Object.keys(structuredData).length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                background: T.bgInner,
                border: `1px solid ${T.border}`,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: T.text,
                }}
              >
                Details
              </h3>
              {Object.entries(structuredData).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    fontSize: 13,
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: T.textMuted }}>{key}</span>
                  <span style={{ color: T.text, fontWeight: 500 }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tags and "Related Screenshots" were removed here deliberately.
              For a photo or screenshot the tags were machine noise — the Hindi OCR
              emitted one per transcribed line, so a document surfaced twelve copies
              of "disputed" — and "related" was every other image the user owned,
              matched on nothing but being an image. Neither told the reader
              anything true about the document in front of them. Key points and
              the export stay; they are derived from this document's own content. */}

          {/* Key points */}
          {keyPoints.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: T.text,
                }}
              >
                Key Points
              </h3>
              <ul style={{ paddingLeft: 20, color: T.text }}>
                {keyPoints.map((point, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      marginBottom: 6,
                      listStyleType: 'disc',
                    }}
                  >
                    <span style={{ color: 'var(--coral)' }}>●</span> {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Combined-document analysis. Only rendered for a save that IS a
              combination of several documents. A single photo has nothing to
              aggregate, so it used to show an empty picker inviting the user to
              aggregate a document with unrelated ones — which is how combined
              documents ended up mixing content that had no relation. Choosing
              what to combine now happens in Saves → Documents, where the user
              can see and tick the actual documents. */}
          {aggregateData && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              background: T.bgInner,
              border: `1px solid ${T.border}`,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                color: T.text,
              }}
            >
              Combined document
            </h3>
              <>
                {/* Summary */}
                {aggregateData.summary && (
                  <p style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 14 }}>
                    {aggregateData.summary}
                  </p>
                )}

                {/* Highlights */}
                {aggregateData.highlights?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Key Highlights
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aggregateData.highlights.map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--coral)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                          <span style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Themes */}
                {aggregateData.themes?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Themes
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aggregateData.themes.map((theme, i) => (
                        <div key={i} style={{ background: T.bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 15 }}>{theme.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{theme.title}</span>
                          </div>
                          {theme.points?.map((pt, j) => (
                            <div key={j} style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, paddingLeft: 20 }}>· {pt}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {aggregateData.actions?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Next Steps
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aggregateData.actions.map((a, i) => {
                        const priorityColor = a.priority === 'high' ? '#c0392b' : a.priority === 'medium' ? '#e67e22' : '#7f8c8d';
                        return (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: priorityColor, borderRadius: 4, padding: '2px 5px', flexShrink: 0, marginTop: 2, textTransform: 'uppercase' }}>
                              {a.priority}
                            </span>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{a.action}</p>
                              {a.reason && <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{a.reason}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Comparison */}
                {aggregateData.comparison && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Comparison
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: '#eafaf1', borderRadius: 8, padding: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#1e8449', marginBottom: 4 }}>SIMILARITIES</p>
                        {aggregateData.comparison.similarities?.map((s, i) => (
                          <p key={i} style={{ fontSize: 12, color: '#1a5e2a', lineHeight: 1.4, marginBottom: 3 }}>· {s}</p>
                        ))}
                      </div>
                      <div style={{ background: '#fef9e7', borderRadius: 8, padding: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#9a7d0a', marginBottom: 4 }}>DIFFERENCES</p>
                        {aggregateData.comparison.differences?.map((d, i) => (
                          <p key={i} style={{ fontSize: 12, color: '#7e6302', lineHeight: 1.4, marginBottom: 3 }}>· {d}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {aggregateData.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {aggregateData.tags.map((tag, i) => (
                      <span key={i} style={{ fontSize: 11, background: T.bgInner, color: T.textMuted, borderRadius: 4, padding: '2px 7px', border: `1px solid ${T.border}` }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleExportPdf}
                  style={{ marginTop: 4, padding: '8px 12px', fontSize: 13, borderRadius: 6, background: 'var(--coral)', color: '#fff', border: 0, cursor: 'pointer', width: '100%' }}
                >
                  📄 Export as PDF
                </button>
              </>
          </div>
          )}

        </div>
      </div>

      {/* Fixed action bar at bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          boxSizing: 'border-box',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          background: T.bg,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={handleShare}
          style={{
            flex: 1,
            padding: '10px 6px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${T.border}`,
            background: T.bg,
            color: T.text,
            cursor: 'pointer',
          }}
        >
          ↗ Share
        </button>
        <button
          onClick={handleExportPdf}
          style={{
            flex: 1,
            padding: '10px 6px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${T.border}`,
            background: T.bg,
            color: T.text,
            cursor: 'pointer',
          }}
        >
          Export PDF
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            flex: 1,
            padding: '10px 6px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid rgba(211,51,51,0.24)',
            background: 'rgba(211,51,51,0.08)',
            color: T.redFg,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
        <button
          onClick={() => onNavigate('home')}
          style={{
            flex: 1,
            padding: '10px 6px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: 0,
            background: 'var(--coral)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            style={{
              background: T.bg,
              borderRadius: 12,
              padding: 20,
              maxWidth: 280,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Delete</h2>
            <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Are you sure you want to delete this screenshot?
            </p>
            {deleteError && (
              <p style={{ fontSize: 13, color: T.redFg, marginBottom: 12 }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.bg,
                  color: T.text,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 6,
                  border: 0,
                  background: T.redFg,
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share sheet modal */}
      {showShareSheet && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setShowShareSheet(false)}
        >
          <div
            style={{
              background: T.bg,
              borderRadius: '12px 12px 0 0',
              padding: 20,
              width: '100%',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Share</h2>
            {shareError && (
              <p style={{ fontSize: 13, color: T.redFg, marginBottom: 12 }}>
                {shareError}
              </p>
            )}
            {save?.shareId ? (
              <>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: T.bgInner,
                    marginBottom: 12,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: T.text,
                  }}
                >
                  {`${window.location.origin}/s/${save.shareId}`}
                </div>
                <button
                  onClick={handleCopyShareLink}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: 0,
                    background: 'var(--coral)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Copy Link
                </button>
              </>
            ) : (
              <button
                onClick={handleShare}
                disabled={shareLoading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 6,
                  border: 0,
                  background: 'var(--coral)',
                  color: '#fff',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: shareLoading ? 0.6 : 1,
                }}
              >
                {shareLoading ? 'Creating link...' : 'Create share link'}
              </button>
            )}
            <button
              onClick={() => setShowShareSheet(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: T.text,
            color: T.bg,
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 12,
            zIndex: 2000,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
