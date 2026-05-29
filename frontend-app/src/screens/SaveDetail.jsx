import { useEffect, useState } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';
import ScreenshotDetail from './ScreenshotDetail';

// ─── Theme palette using design system CSS variables ─────────────────────────
// Uses app-wide CSS variables for surfaces, text, and semantic colors.
// SaveDetail applies a card-like style with proper contrast via CSS variables.
const T = {
  bg:           'var(--colors-surface-surface)',    // outer card (white/light)
  bgInner:      'var(--colors-surface-0)',          // inner sections (light grey)
  bgChip:       'var(--colors-surface-1)',          // tag pill (medium grey)
  border:       'var(--colors-stroke-primary)',     // hairline dividers
  text:         'var(--colors-type-primary)',       // primary text (black)
  textMuted:    'var(--colors-type-secondary)',     // secondary text (muted)
  textFaint:    'var(--colors-type-tertiary)',      // hints / labels (faint)
  amberBg:      'rgba(217,144,40,0.10)',
  amberBorder:  'rgba(217,144,40,0.35)',
  amberFg:      '#d99028',
  redBg:        'rgba(211,51,51,0.10)',
  redBorder:    'rgba(211,51,51,0.40)',
  redFg:        '#e36a6a',
  greenBg:      'rgba(70,176,118,0.16)',
  greenFg:      '#46b076',
};

// Category → icon + accent. Drives the header pill and recipe-step bullets.
const CATEGORY_META = {
  food:       { icon: '🍴', label: 'Food',       accent: '#46b076' },
  travel:     { icon: '🛣',  label: 'Travel',     accent: '#5a9cd6' },
  shopping:   { icon: '🛍',  label: 'Shopping',   accent: '#a374e0' },
  experience: { icon: '🎫', label: 'Experience', accent: '#d65a8a' },
  blog:       { icon: '📰', label: 'Blog',       accent: '#9aa5b3' },
  tech:       { icon: '💻', label: 'Tech',       accent: '#3ec1c9' },
  fashion:    { icon: '👗', label: 'Fashion',    accent: '#e07ec1' },
  beauty:     { icon: '💄', label: 'Beauty',     accent: '#f08aae' },
  other:      { icon: '📌', label: 'Other',      accent: '#9a9a93' },
  general:    { icon: '📌', label: 'General',    accent: '#9a9a93' },
};
const catMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.other;

// Frontend safety-net hallucination guard (mirrors backend). Catches
// character-level repetition + word n-gram repetition. Applied to transcript,
// title, and summary so we never render visibly-broken text.
const looksHallucinated = (text) => {
  if (!text || text.length < 30) return false;
  if (/(.{3,})\1{4,}/.test(text)) return true;
  const words = String(text).trim().split(/\s+/);
  if (words.length < 12) return false;
  const grams = {};
  for (let i = 0; i < words.length - 2; i++) {
    const g = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase();
    grams[g] = (grams[g] || 0) + 1;
    if (grams[g] >= 5) return true;
  }
  return false;
};

const prettifyTag = (t) => String(t).replace(/[-_]+/g, ' ').trim();

const directionsHref = (place) => {
  if (!place) return null;
  const q = [place.name, place.address, place.city, place.country].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
};

// ─── Atomic UI bits ───────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint, margin: '18px 0 8px' }}>{children}</p>
);

const Chip = ({ children, accent }) => (
  <span style={{
    display: 'inline-block', fontSize: 12, padding: '5px 11px', borderRadius: '999px', fontWeight: 500,
    background: accent ? `${accent}22` : 'var(--forest-faint)', color: accent || 'var(--forest)',
    border: `0.5px solid ${accent ? `${accent}44` : '#ccdacc'}`,
  }}>{children}</span>
);

const PillRow = ({ items, accent }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {items.map((t, i) => <Chip key={i} accent={accent}>{prettifyTag(t)}</Chip>)}
  </div>
);

const KVTable = ({ rows }) => (
  <div style={{ background: 'var(--paper)', borderRadius: '12px', padding: '4px 0', border: '0.5px solid var(--hairline-soft)' }}>
    {rows.filter(([, v]) => v).map(([k, v], i, arr) => (
      <div key={i} style={{
        display: 'grid', gridTemplateColumns: '90px 1fr', columnGap: 12,
        padding: '12px 14px',
        borderBottom: i < arr.length - 1 ? '0.5px solid var(--hairline-soft)' : 'none',
        fontSize: 13,
      }}>
        <div style={{ color: T.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
        <div style={{ color: T.text }}>{v}</div>
      </div>
    ))}
  </div>
);

const WarningBanner = ({ tone = 'amber', icon, children, action }) => {
  const p = tone === 'red'
    ? { bg: T.redBg, border: T.redBorder, fg: T.redFg }
    : { bg: T.amberBg, border: T.amberBorder, fg: T.amberFg };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 10, background: p.bg, border: `0.5px solid ${p.border}`,
      borderRadius: '12px', padding: '10px 14px', fontSize: 13, color: p.fg, marginBottom: 12, lineHeight: 1.5,
    }}>
      <span style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
        <span>{children}</span>
      </span>
      {action}
    </div>
  );
};

// Header pill row: category chip · author handle · status chip
const CardHeader = ({ save }) => {
  const meta = catMeta(save?.category);
  const status = save?.processingStatus;
  const statusMap = {
    done:       { label: 'Done',       bg: T.greenBg,      fg: T.greenFg },
    partial:    { label: 'Partial',    bg: T.amberBg,      fg: T.amberFg },
    failed:     { label: 'Failed',     bg: T.redBg,        fg: T.redFg },
    processing: { label: 'Processing', bg: 'rgba(154,154,147,0.16)', fg: T.textMuted },
  };
  const sm = statusMap[status] || statusMap.processing;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999,
          background: `${meta.accent}22`, color: meta.accent,
          fontSize: 11, fontWeight: 600,
          border: `1px solid ${meta.accent}44`,
        }}>
          <span>{meta.icon}</span><span>{meta.label}</span>
        </span>
        {(save?.authorHandle || save?.source) && (
          <span style={{ fontSize: 12, color: T.textMuted }}>
            {save.authorHandle ? `@${save.authorHandle}` : ''}
            {save.authorHandle && save.source ? ' · ' : ''}
            {save.source ? save.source[0].toUpperCase() + save.source.slice(1) : ''}
          </span>
        )}
      </div>
      <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.fg }}>
        {sm.label}
      </span>
    </div>
  );
};

// ─── Action bar — dynamic per category + structured data ──────────────────────
const ActionBar = ({ save, onIntent, onOpenSource, onShare }) => {
  const sd = save?.aiAnalysis?.structuredData || {};
  const { place, product, event, itinerary } = sd;
  const cat = save?.category;
  const intentStatus = save?.intentStatus;
  const buttons = [];

  // Directions: any save with a place (recipe-spot, store, hill station, etc.)
  const mapsUrl = directionsHref(place);
  if (mapsUrl) buttons.push({ key: 'directions', label: 'Directions', sublabel: 'Open in Maps', iconBg: '#d8eed8', iconColor: '#1b5e1f', href: mapsUrl, kind: 'primary' });

  // Buy now: only when a verified buyUrl exists
  if (product?.buyUrl) buttons.push({ key: 'buy', label: 'Buy now', sublabel: product.brand || 'View product', iconBg: '#fef0cc', iconColor: '#9a6800', href: product.buyUrl, kind: 'primary' });

  // Get tickets
  if (event?.ticketUrl) buttons.push({ key: 'tickets', label: 'Get tickets', sublabel: 'Reserve now', iconBg: '#e8e4f8', iconColor: '#4a3db0', href: event.ticketUrl, kind: 'primary' });

  // Trip planning: travel/experience categories OR an itinerary OR a non-store place
  const isTripContext = itinerary || (place && ['travel', 'experience'].includes(cat));
  if (isTripContext) {
    buttons.push({ key: 'plan',  label: 'Plan trip', sublabel: 'Build itinerary', iconBg: 'var(--forest-soft)', iconColor: 'var(--forest)', onClick: () => onIntent('planned'), kind: 'secondary' });
    buttons.push({ key: 'stays', label: 'Find stays', sublabel: 'Search hotels', iconBg: '#daeaf8', iconColor: '#1a5f8a', href: `https://www.google.com/travel/hotels?q=${encodeURIComponent(itinerary?.destination || place?.name || cat)}`, kind: 'secondary' });
  }

  // Share (shopping spotlight wants this prominent)
  const shareSubLabel = save?.shareId ? 'Link active' : 'Create link';
  buttons.push({ key: 'share', label: 'Share', sublabel: shareSubLabel, iconBg: 'var(--forest-soft)', iconColor: 'var(--forest)', onClick: onShare, kind: 'secondary' });

  // Lifecycle: tried/visited/attended with dynamic label
  const triedLabel = cat === 'travel'      ? (intentStatus === 'tried' ? '✓ Visited'  : 'Mark visited')
                   : cat === 'experience'  ? (intentStatus === 'tried' ? '✓ Attended' : 'Mark attended')
                   :                          (intentStatus === 'tried' ? '✓ Tried'    : 'Mark tried');
  const triedSubLabel = intentStatus === 'tried' ? 'Completed' : 'Mark as done';
  buttons.push({
    key: 'tried', label: triedLabel, sublabel: triedSubLabel,
    iconBg: intentStatus === 'tried' ? 'var(--forest-soft)' : 'var(--forest)',
    iconColor: intentStatus === 'tried' ? 'var(--forest)' : '#fff',
    onClick: () => onIntent(intentStatus === 'tried' ? 'saved' : 'tried'),
    kind: intentStatus === 'tried' ? 'primary' : 'secondary',
  });

  // Open source fallback (only if no other primary)
  if (save?.url && !buttons.find((b) => b.kind === 'primary')) {
    buttons.unshift({ key: 'source', label: 'Open source', sublabel: 'View link', iconBg: '#daeaf8', iconColor: '#1a5f8a', onClick: onOpenSource, kind: 'primary' });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14 }}>
      {buttons.map((b) => {
        const cardStyle = {
          background: 'var(--paper)',
          border: '0.5px solid var(--hairline)',
          borderRadius: '16px',
          padding: '12px 14px',
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          transition: 'all 0.2s ease',
        };
        if (b.href) {
          return (
            <a key={b.key} href={b.href} target="_blank" rel="noreferrer" style={cardStyle}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: b.iconBg, color: b.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
                {b.key === 'directions' && '📍'}
                {b.key === 'buy' && '🛒'}
                {b.key === 'tickets' && '🎟'}
                {b.key === 'source' && '↗'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: 'center' }}>{b.label}</span>
              <span style={{ fontSize: 11, color: T.textMuted, textAlign: 'center' }}>{b.sublabel}</span>
            </a>
          );
        }
        return (
          <button key={b.key} onClick={b.onClick} style={cardStyle}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: b.iconBg, color: b.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
              {b.key === 'plan' && '🗓'}
              {b.key === 'stays' && '🏨'}
              {b.key === 'share' && '↗'}
              {b.key === 'tried' && (intentStatus === 'tried' ? '✓' : '○')}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: 'center' }}>{b.label}</span>
            <span style={{ fontSize: 11, color: T.textMuted, textAlign: 'center' }}>{b.sublabel}</span>
          </button>
        );
      })}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SaveDetail({ onNavigate, payload }) {
  const id = payload?.id;
  const [save, setSave] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [completed, setCompleted] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const detail = await api.getSaveById(id);
        if (!active) return;

        // Check if auth failed (401 or unauthorized message)
        if (detail.status === 'error' && (detail.error?.message?.includes('Unauthorized') || detail.error?.message?.includes('401'))) {
          onNavigate('login');
          return;
        }

        if (detail.status !== 'success') throw new Error(detail.error?.message || 'Not found');
        setSave(detail.data);
        setCompleted(detail.data?.engagement?.completed || false);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    // Load recommendations separately so a failure doesn't block the detail view
    api.getRecommendations(id)
      .then((r) => { if (active && r?.status === 'success') setRecs(r.data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, onNavigate]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleteError(null); setDeleting(true);
    try {
      const res = await api.deleteSave(id);
      if (res.status === 'success') {
        setConfirmDelete(false);
        onNavigate('home', { refresh: true });
      }
      else setDeleteError(res.error?.message || 'Delete failed');
    } catch (err) { setDeleteError(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const handleIntent = async (next) => {
    if (!id) return;
    try {
      const r = await api.updateIntent(id, { intentStatus: next });
      if (r.status === 'success') setSave(r.data);
    } catch {}
  };

  const getPrimaryCTALabel = () => {
    const category = save?.category || 'general';
    if (category === 'food') return completed ? 'Cooked!' : 'Mark as cooked';
    if (category === 'travel') return 'Plan this trip';
    if (category === 'shopping') return 'Mark as bought';
    if (category === 'experience') return 'Mark as done';
    return completed ? 'Done!' : 'Mark as tried';
  };

  const handlePrimaryCTA = async () => {
    if (!id) return;
    try {
      const newStatus = !completed;
      setCompleted(newStatus);
      await api.patchSave(id, { completed: newStatus });
    } catch (err) {
      showToast('Failed to update status');
      setCompleted(!completed);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.retrySave(id);
      if (res?.status === 'success') setSave(res.data);
    } finally { setRetrying(false); }
  };

  const handleShare = async () => {
    setShowShareSheet(true);
    setShareError(null);
    if (save?.shareId) return;

    setShareLoading(true);
    try {
      const res = await api.shareSave(id);
      if (res.status === 'success') {
        setSave({ ...save, shareId: res.shareId });
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

  const handleUnshare = async () => {
    if (!save?.shareId) return;
    try {
      const res = await api.unshareSave(id);
      if (res.status === 'success') {
        setSave({ ...save, shareId: null });
        showToast('Share link removed');
        setShowShareSheet(false);
      }
    } catch (err) {
      setShareError(err.message || 'Failed to remove share link');
    }
  };

  if (!id) {
    return (
      <div className="phone-frame" style={{ background: T.bg, color: T.text }}>
        <div style={{ padding: 24 }}>
          <p>No save selected.</p>
          <button style={{ background: T.text, color: T.bg, padding: '10px 18px', border: 0, borderRadius: 10, marginTop: 12 }} onClick={() => onNavigate('home')}>Back</button>
        </div>
      </div>
    );
  }
  if (loading) return <div className="phone-frame" style={{ background: T.bg, color: T.text }}><div style={{ padding: 32, textAlign: 'center' }}>Loading…</div></div>;
  if (error) return <div className="phone-frame" style={{ background: T.bg, color: T.text }}><div style={{ padding: 32, color: T.redFg }}>{error}</div></div>;

  // Route to ScreenshotDetail for screenshot saves
  const isScreenshot = save?.contentType === 'image' || save?.source === 'screenshot';

  if (isScreenshot) {
    return <ScreenshotDetail save={save} onNavigate={onNavigate} />;
  }

  const sd = save?.aiAnalysis?.structuredData || {};
  const recipe = sd.recipe?.isRecipe ? sd.recipe : null;
  const itinerary = sd.itinerary;
  const product = sd.product;
  const event = sd.event;
  const place = sd.place;
  const meta = catMeta(save?.category);

  const rawTranscript = save?.aiAnalysis?.transcription?.text || '';
  const transcriptLang = save?.aiAnalysis?.transcription?.detectedLanguage;
  const transcriptIsBad = rawTranscript && looksHallucinated(rawTranscript);
  const transcript = transcriptIsBad ? '' : rawTranscript;

  // Apply hallucination guard to title + summary too (UI safety net).
  const safeTitle = save?.title && !looksHallucinated(save.title) ? save.title : 'Untitled save';
  const rawSummary = save?.aiAnalysis?.summary || '';
  const safeSummary = rawSummary && !looksHallucinated(rawSummary) ? rawSummary : '';

  const buyUrlStripped = !!save?.aiAnalysis?.flags?.buyUrlStripped;

  // Show the noisy raw IG description only if we have nothing better
  const showRawDescription = save?.description && !safeSummary;

  return (
    <div className="phone-frame" style={{ background: T.bg, color: T.text, minHeight: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 0 80px' }}>
        {/* Hero / static thumbnail with overlays */}
        <div style={{ borderRadius: 0, marginBottom: 0, overflow: 'hidden', background: '#000', aspectRatio: '16 / 11', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {(save?.thumbnail || save?.image)
            ? <SmartImage saveId={save._id} src={save.thumbnail || save.image} alt={safeTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: T.textFaint, fontSize: 36 }}>▢</span>}

          {/* Top gradient overlay with back + delete buttons */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 14px' }}>
            <button onClick={() => onNavigate('home')} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 0, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <button onClick={() => setConfirmDelete(true)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 0, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
          </div>

          {/* Bottom gradient overlay with badges */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)', display: 'flex', alignItems: 'flex-end', padding: '14px 14px', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: '999px',
              background: `${meta.accent}22`, color: meta.accent,
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${meta.accent}44`,
            }}>
              <span>{meta.icon}</span><span>{meta.label}</span>
            </span>
            {save?.source && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 600, border: '1px solid rgba(255,255,255,0.25)' }}>
                {save.source[0].toUpperCase() + save.source.slice(1)}
              </span>
            )}
          </div>
        </div>

        {/* Content area padding and status messages */}
        <div style={{ padding: '14px 18px 0' }}>
          {/* Status messages: show context-aware info based on processingStages */}
        {(() => {
          const hasGoodData = save?.aiAnalysis?.summary || (save?.aiAnalysis?.keyPoints?.length > 0);
          const stages = save?.processingStages || {};

          // Video unavailable but we have fallback analysis from metadata
          if (stages.videoDownload?.error && hasGoodData) {
            return (
              <WarningBanner tone="amber" icon="📹">
                Video couldn't be accessed — analysis from title & description
              </WarningBanner>
            );
          }

          // Video still processing
          if (!stages.videoDownload?.completed && !stages.videoDownload?.error && save?.processingStatus === 'processing') {
            return (
              <WarningBanner tone="amber">
                ⏳ Enhancing with video details...
              </WarningBanner>
            );
          }

          // Processing failed with no fallback data
          if (save?.processingStatus === 'failed' && !hasGoodData) {
            return (
              <WarningBanner
                tone="red"
                action={
                  <button
                    onClick={handleRetry} disabled={retrying}
                    style={{ background: T.redFg, color: T.bg, border: 0, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >{retrying ? '…' : 'Retry'}</button>
                }
              >
                Could not process this save.
              </WarningBanner>
            );
          }

          // Partial processing with insufficient data
          if (save?.processingStatus === 'partial' && !hasGoodData) {
            return (
              <WarningBanner
                tone="amber"
                action={
                  <button
                    onClick={handleRetry} disabled={retrying}
                    style={{ background: T.amberFg, color: T.bg, border: 0, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >{retrying ? '…' : 'Retry'}</button>
                }
              >
                Still gathering details...
              </WarningBanner>
            );
          }

          return null;
        })()}

        <CardHeader save={save} />

        <h2 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, margin: '0 0 8px', color: T.text, fontFamily: 'var(--font-display)' }}>{safeTitle}</h2>

        {safeSummary && (
          <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6, marginBottom: 12, fontFamily: 'var(--font-body)' }}>{safeSummary}</p>
        )}
        {showRawDescription && (
          <p style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.6, marginBottom: 12, fontFamily: 'var(--font-body)' }}>{save.description}</p>
        )}

        {/* Extracted Location — shows city/country if available with maps link */}
        {save?.extractedLocation?.city && (
          <div style={{ marginBottom: 12 }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(save.extractedLocation.city + ', ' + (save.extractedLocation.country || ''))}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'var(--forest-faint)',
                color: 'var(--forest)',
                fontSize: 12,
                fontWeight: 500,
                border: '0.5px solid var(--hairline)',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <span>📍</span>
              <span>{save.extractedLocation.city}{save.extractedLocation.country ? ', ' + save.extractedLocation.country : ''}</span>
            </a>
          </div>
        )}

        {/* Buy link removed shield — fires only when backend stripped a URL */}
        {buyUrlStripped && (
          <WarningBanner tone="red" icon="🛡">
            Buy link was removed — could not verify it was in the original content.
          </WarningBanner>
        )}

        {/* Key points — concrete bullets distilled from caption/OCR/transcript.
            Shown especially valuable when transcript is missing/hallucinated. */}
        {save?.aiAnalysis?.keyPoints?.length > 0 && (
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline-soft)', borderRadius: '16px', padding: '14px 16px', marginBottom: 12 }}>
            <SectionLabel>Key points</SectionLabel>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {save.aiAnalysis.keyPoints.map((kp, i, arr) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '0.5px solid var(--hairline-soft)' : 'none' }}>
                  <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: 'var(--forest)', marginTop: 8 }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: T.text }}>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tag chips */}
        {save?.tags?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <PillRow items={save.tags} />
          </div>
        )}

        {/* Screenshot analysis — for contentType='image' with screenshotAnalysis */}
        {save?.contentType === 'image' && save?.aiAnalysis?.screenshotAnalysis && (
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: '12px', padding: 14, marginBottom: 12 }}>
            {save.aiAnalysis.screenshotAnalysis.data?.features?.length > 0 && (
              <>
                <SectionLabel>Features</SectionLabel>
                <PillRow items={save.aiAnalysis.screenshotAnalysis.data.features} accent={meta.accent} />
              </>
            )}
            {save.aiAnalysis.screenshotAnalysis.data?.framework && (
              <p style={{ fontSize: 13, color: T.text, marginTop: 10, marginBottom: 4 }}>
                <strong>Framework:</strong> {save.aiAnalysis.screenshotAnalysis.data.framework}
              </p>
            )}
            {save.aiAnalysis.screenshotAnalysis.data?.type && (
              <p style={{ fontSize: 13, color: T.text, marginTop: 4, marginBottom: 0 }}>
                <strong>Type:</strong> {save.aiAnalysis.screenshotAnalysis.data.type}
              </p>
            )}
          </div>
        )}

        {/* Screenshot carousel */}
        {save?.screenshots?.length > 0 && (
          <>
            <SectionLabel>Screenshots ({save.screenshots.length})</SectionLabel>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {save.screenshots.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((sc, i) => (
                <a key={i} href={sc.url || sc.thumbnailUrl} target="_blank" rel="noreferrer"
                   onClick={(e) => { if (!sc.url) { e.preventDefault(); alert('Original purged after 2 working days — thumbnail + OCR text kept.'); } }}
                   style={{ flexShrink: 0, width: 88, display: 'block', borderRadius: 8, overflow: 'hidden', position: 'relative', border: `1px solid ${T.border}` }}
                   title={sc.ocrText ? sc.ocrText.slice(0, 200) : ''}>
                  <img src={sc.thumbnailUrl} alt={`Screenshot ${i + 1}`} style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block', opacity: sc.url ? 1 : 0.65 }} />
                  {!sc.url && <span style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 3 }}>purged</span>}
                </a>
              ))}
            </div>
          </>
        )}

        {/* Recipe block — wrapped in a contained card with bg */}
        {recipe && (
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: '16px', padding: 14, marginTop: 10 }}>
            {(recipe.cookingTime || recipe.servings || recipe.cuisine) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {recipe.cookingTime && (
                  <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: '999px', border: `0.5px solid var(--hairline)`, color: T.textMuted }}>
                    ⏱ {recipe.cookingTime}
                  </span>
                )}
                {recipe.servings && (
                  <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: '999px', border: `0.5px solid var(--hairline)`, color: T.textMuted }}>
                    🍽 {recipe.servings}
                  </span>
                )}
                {recipe.cuisine && (
                  <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: '999px', border: `0.5px solid var(--hairline)`, color: T.textMuted }}>
                    {recipe.cuisine}
                  </span>
                )}
              </div>
            )}
            {recipe.ingredients?.length > 0 && (
              <>
                <SectionLabel>Ingredients</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {recipe.ingredients.map((ing, i) => (
                    <span key={i} style={{
                      display: 'inline-block', fontSize: 12, padding: '5px 11px', borderRadius: '999px',
                      background: 'var(--forest-faint)', color: 'var(--forest)',
                      border: `0.5px solid #ccdacc`, fontWeight: 500,
                    }}>{prettifyTag(ing)}</span>
                  ))}
                </div>
              </>
            )}
            {recipe.steps?.length > 0 && (
              <>
                <SectionLabel>Steps</SectionLabel>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recipe.steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, marginBottom: i < recipe.steps.length - 1 ? 12 : 0, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                        background: meta.accent, color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.55, paddingTop: 2, color: T.text }}>{s}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}

        {/* Product card (when no recipe) — name/brand/price */}
        {product && !recipe && (product.name || product.brand || product.price) && (
          <>
            <SectionLabel>Product</SectionLabel>
            <KVTable
              rows={[
                ['Name', product.name],
                ['Brand', product.brand],
                ['Price', product.price ? `${product.currency || '₹'} ${product.price}` : null],
              ]}
            />
          </>
        )}

        {/* Available items (product variants) */}
        {product?.availableItems?.length > 0 && (
          <>
            <SectionLabel>Available {meta.label === 'Shopping' ? 'items' : 'options'}</SectionLabel>
            <PillRow items={product.availableItems} />
          </>
        )}

        {/* Place / Location — label adapts to context */}
        {place && (
          <>
            <SectionLabel>{recipe ? 'Location' : product ? 'Store location' : 'Place'}</SectionLabel>
            <KVTable
              rows={[
                [recipe ? 'Area' : product ? 'Store' : 'Place', place.name],
                ['Address', place.address],
                ['City', [place.city, place.country].filter(Boolean).join(', ')],
                ['Hours', place.hours],
              ]}
            />
          </>
        )}

        {/* Itinerary */}
        {itinerary && (
          <>
            <SectionLabel>Destination</SectionLabel>
            <KVTable
              rows={[
                ['Place',    itinerary.destination],
                ['Duration', itinerary.duration],
                ['Season',   itinerary.bestSeason],
                ['Cost',     itinerary.estimatedCost],
              ]}
            />
            {itinerary.highlights?.length > 0 && (
              <>
                <SectionLabel>Highlights</SectionLabel>
                <PillRow items={itinerary.highlights} accent={meta.accent} />
              </>
            )}
          </>
        )}

        {/* Event */}
        {event && (
          <>
            <SectionLabel>Event</SectionLabel>
            <KVTable rows={[
              ['Event', event.eventName],
              ['Venue', event.venue],
              ['When',  event.eventDate ? new Date(event.eventDate).toLocaleString() : null],
              ['Price', event.price ? `${event.currency || ''} ${event.price}` : null],
            ]} />
          </>
        )}

        {/* Transcript hallucination warning */}
        {transcriptIsBad && (
          <WarningBanner tone="amber">
            Transcript was hallucinated (repeating characters detected) — removed. Summary based on title and description only.
          </WarningBanner>
        )}
        {transcript && (
          <div style={{ marginTop: 14, marginBottom: 12 }}>
            <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: '12px', padding: 14 }}>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: !showFullTranscript ? 4 : 'unset', WebkitBoxOrient: 'vertical', overflow: !showFullTranscript ? 'hidden' : 'visible' }}>
                {transcript}
              </div>
              {transcript.split('\n').length > 4 && (
                <button
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--amber-link)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {showFullTranscript ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
            {transcriptLang && transcriptLang !== 'en' && (
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                📝 Translated from {transcriptLang}
              </p>
            )}
          </div>
        )}

        {/* Action bar */}
        <ActionBar
          save={save}
          onIntent={handleIntent}
          onOpenSource={() => window.open(save.url, '_blank')}
          onShare={handleShare}
        />

        {/* Similar saves */}
        {recs.length > 0 && (
          <>
            <SectionLabel>Similar saves</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.slice(0, 3).map((r) => {
                const pct = Math.round((r.score || 0) * 100);
                const rMeta = catMeta(r.category);
                return (
                  <div key={r._id}
                       style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline-soft)', borderRadius: '16px', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}
                       onClick={() => onNavigate('save-detail', { id: r._id })}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${rMeta.accent}22`, color: rMeta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {rMeta.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        {pct}% match · {rMeta.label}
                      </div>
                    </div>
                    <span style={{ color: T.textMuted, fontSize: 18 }}>›</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
          background: T.text, color: T.bg, padding: '10px 18px', borderRadius: 999,
          fontSize: 13, fontWeight: 500, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', zIndex: 60,
        }}>{toast}</div>
      )}

      {confirmDelete && (
        <div onClick={() => !deleting && setConfirmDelete(false)}
             style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--paper)', color: T.text, borderRadius: '20px', padding: 24, width: '100%', maxWidth: 320, border: '0.5px solid var(--hairline)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fce8df', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ fontSize: 24, color: '#b85c28' }}>🗑</span>
            </div>
            <h3 style={{ fontSize: 17, textAlign: 'center', marginBottom: 6, fontWeight: 600, fontFamily: 'var(--font-display)' }}>Delete this save?</h3>
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
              It will be removed from your feed and any collections. This can't be undone.
            </p>
            {deleteError && <p style={{ color: T.redFg, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{deleteError}</p>}
            <button onClick={handleDelete} disabled={deleting}
                    style={{ width: '100%', padding: '12px 0', background: '#b85c28', color: '#fff', border: 0, borderRadius: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                    style={{ width: '100%', padding: '12px 0', background: 'transparent', color: T.text, border: `0.5px solid var(--hairline)`, borderRadius: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showShareSheet && (
        <div onClick={() => setShowShareSheet(false)}
             style={{ position: 'fixed', bottom: 0, left: 0, right: 0, top: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 55 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 40, height: 3, background: 'var(--hairline)', borderRadius: '999px', margin: '0 auto 12px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Share this save</h3>
              <button onClick={() => setShowShareSheet(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0, color: T.textMuted }}>✕</button>
            </div>

            {shareLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: T.textMuted }}>Creating share link…</p>
              </div>
            ) : shareError ? (
              <div style={{ background: T.redBg, color: T.redFg, padding: 12, borderRadius: '12px', marginBottom: 16, fontSize: 13 }}>
                {shareError}
              </div>
            ) : save?.shareId ? (
              <>
                <div style={{ background: 'var(--paper)', padding: 14, borderRadius: '12px', marginBottom: 14, border: '0.5px solid var(--hairline)' }}>
                  <p style={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, margin: '0 0 8px' }}>Share URL</p>
                  <div style={{ fontSize: 12, color: T.text, wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 12, padding: '8px', background: 'var(--forest-faint)', borderRadius: '8px' }}>
                    {`${window.location.origin}/s/${save.shareId}`}
                  </div>
                  <button onClick={handleCopyShareLink} style={{ width: '100%', padding: '12px 0', background: 'var(--forest)', color: '#fff', border: 0, borderRadius: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Copy link
                  </button>
                </div>

                <div style={{ background: 'var(--paper)', padding: 14, borderRadius: '12px', marginBottom: 14, border: '0.5px solid var(--hairline)' }}>
                  <p style={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, margin: '0 0 8px' }}>Save preview</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {save.thumbnail && <SmartImage src={save.thumbnail} style={{ width: 60, height: 60, borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: '0 0 4px 0' }}>{save.title}</p>
                      <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Public preview with OG meta tags</p>
                    </div>
                  </div>
                </div>

                <button onClick={handleUnshare} style={{ width: '100%', padding: '12px 0', background: 'transparent', color: T.redFg, border: `0.5px solid ${T.redFg}`, borderRadius: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Stop sharing
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
