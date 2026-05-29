import { useEffect, useState } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';

const T = {
  bg: 'var(--paper)',
  bgInner: 'var(--forest-faint)',
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
  const [relatedScreenshots, setRelatedScreenshots] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [toast, setToast] = useState(null);
  const [aggregating, setAggregating] = useState(false);
  const [aggregateError, setAggregateError] = useState(null);
  const [combinedSummary, setCombinedSummary] = useState(null);
  const [commonThemes, setCommonThemes] = useState(null);
  const [keyInsights, setKeyInsights] = useState(null);
  const [suggestedAction, setSuggestedAction] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!save?._id) return;

    // Fetch related screenshots (up to 6, excluding current)
    api.getSaves()
      .then((r) => {
        if (r?.status === 'success' && r?.data) {
          const related = r.data
            .filter((s) => s.source === 'screenshot' && s._id !== save._id)
            .slice(0, 6);
          setRelatedScreenshots(related);
        }
      })
      .catch(() => {});

    // Fetch recommendations
    api.getRecommendations(save._id)
      .then((r) => {
        if (r?.status === 'success' && r?.data) {
          setRecommendations(r.data);
        }
      })
      .catch(() => {});
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

  const handleAggregate = async () => {
    if (!save?._id) return;
    setAggregating(true);
    setAggregateError(null);

    try {
      // Fetch all related screenshots to get their analysis
      const allSaves = (await api.getSaves()).data || [];
      const relatedScreens = allSaves.filter(
        (s) => (s.contentType === 'image' || s.source === 'screenshot') && s._id !== save._id
      );

      // Build analysis text from current + related screenshots
      const analyses = [save, ...relatedScreens]
        .map((s) => {
          const title = s.title || '';
          const desc = s.description || '';
          const summary = s.aiAnalysis?.summary || '';
          return `Screenshot: ${title}\n${desc}\n${summary}`;
        })
        .join('\n\n---\n\n');

      // Call API
      const res = await api.aggregateScreenshotAnalysis(save._id, analyses);

      if (res.status === 'success') {
        setCombinedSummary(res.data.combinedSummary);
        setCommonThemes(res.data.commonThemes);
        setKeyInsights(res.data.keyInsights);
        setSuggestedAction(res.data.suggestedAction);
      } else {
        setAggregateError(res.error?.message || 'Failed to aggregate');
      }
    } catch (err) {
      setAggregateError(err.message || 'Failed to aggregate');
    } finally {
      setAggregating(false);
    }
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
  const tags = save?.tags || [];
  const structuredData = save?.aiAnalysis?.structuredData || {};

  return (
    <div className="phone-frame" style={{ background: T.bg, color: T.text, minHeight: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        {/* Hero section with overlays */}
        <div
          style={{
            borderRadius: 0,
            marginBottom: 0,
            overflow: 'hidden',
            background: '#000',
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
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: T.textFaint, fontSize: 36 }}>▢</span>
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
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ←
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: 0,
                color: '#fff',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              🗑
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
              gap: 8,
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
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {meta.icon} {meta.label}
            </span>
          </div>
        </div>

        {/* Content section */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          {/* Title */}
          <h1
            style={{
              fontSize: 24,
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
                fontSize: 14,
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
                  fontSize: 12,
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
                  fontSize: 12,
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
                  fontSize: 13,
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
                    fontSize: 12,
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

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: T.text,
                }}
              >
                Tags
              </h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: T.bgInner,
                      border: `1px solid ${T.border}`,
                      color: T.text,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key points */}
          {keyPoints.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 13,
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
                      fontSize: 13,
                      lineHeight: 1.6,
                      marginBottom: 6,
                      listStyleType: 'disc',
                    }}
                  >
                    <span style={{ color: 'var(--forest)' }}>●</span> {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related screenshots */}
          {relatedScreenshots.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: T.text,
                }}
              >
                Related Screenshots
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  paddingBottom: 8,
                }}
              >
                {relatedScreenshots.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => onNavigate('save-detail', { id: s._id })}
                    style={{
                      flex: '0 0 100px',
                      height: 100,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#f0f0f0',
                      cursor: 'pointer',
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    {s.thumbnail || s.image ? (
                      <SmartImage
                        saveId={s._id}
                        src={s.thumbnail || s.image}
                        alt={s.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: T.textMuted,
                        }}
                      >
                        🖼
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aggregate & summarize section */}
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
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: T.text,
              }}
            >
              Aggregate Analysis
            </h3>
            {!combinedSummary ? (
              <>
                <p
                  style={{
                    fontSize: 12,
                    color: T.textMuted,
                    marginBottom: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {relatedScreenshots.length > 0
                    ? 'Combine all related screenshots into a single analysis'
                    : 'No related screenshots to aggregate'}
                </p>
                <button
                  onClick={handleAggregate}
                  disabled={aggregating || relatedScreenshots.length === 0}
                  style={{
                    padding: '8px 12px',
                    fontSize: 12,
                    borderRadius: 6,
                    background: 'var(--forest)',
                    color: '#fff',
                    border: 0,
                    cursor: aggregating ? 'not-allowed' : 'pointer',
                    opacity: aggregating || relatedScreenshots.length === 0 ? 0.6 : 1,
                  }}
                >
                  {aggregating ? 'Aggregating...' : 'Aggregate'}
                </button>
              </>
            ) : (
              <>
                {combinedSummary && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                      Combined Summary
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: T.text,
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {combinedSummary}
                    </p>
                  </div>
                )}
                {commonThemes && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                      Common Themes
                    </p>
                    <p style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                      {commonThemes}
                    </p>
                  </div>
                )}
                {keyInsights && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                      Key Insights
                    </p>
                    <p style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                      {keyInsights}
                    </p>
                  </div>
                )}
                {suggestedAction && (
                  <div>
                    <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                      Suggested Action
                    </p>
                    <p style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                      {suggestedAction}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleExportPdf}
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    borderRadius: 6,
                    background: 'var(--forest)',
                    color: '#fff',
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  Export PDF
                </button>
              </>
            )}
            {aggregateError && (
              <p style={{ fontSize: 12, color: T.redFg, marginTop: 8 }}>{aggregateError}</p>
            )}
          </div>

          {/* Similar saves */}
          {recommendations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: T.text,
                }}
              >
                Similar Saves
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recommendations.slice(0, 3).map((rec) => (
                  <div
                    key={rec._id}
                    onClick={() => onNavigate('save-detail', { id: rec._id })}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: T.bgInner,
                      border: `1px solid ${T.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: T.text,
                        marginBottom: 4,
                      }}
                    >
                      {rec.title}
                    </p>
                    <p style={{ fontSize: 11, color: T.textMuted }}>
                      {rec.category || 'general'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed action bar at bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 14px',
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
            padding: '12px',
            borderRadius: 8,
            fontSize: 13,
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
          onClick={() => onNavigate('home')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: 0,
            background: 'var(--forest)',
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
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Delete</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
              Are you sure you want to delete this screenshot?
            </p>
            {deleteError && (
              <p style={{ fontSize: 12, color: T.redFg, marginBottom: 12 }}>
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
                  fontSize: 12,
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
                  fontSize: 12,
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
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Share</h2>
            {shareError && (
              <p style={{ fontSize: 12, color: T.redFg, marginBottom: 12 }}>
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
                    fontSize: 12,
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
                    background: 'var(--forest)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
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
                  background: 'var(--forest)',
                  color: '#fff',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                  fontSize: 13,
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
                fontSize: 13,
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
            fontSize: 13,
            zIndex: 2000,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
