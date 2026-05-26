import { useEffect, useState } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';

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
  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint, margin: '14px 0 8px' }}>{children}</p>
);

const Chip = ({ children, accent }) => (
  <span style={{
    display: 'inline-block', fontSize: 11, padding: '5px 11px', borderRadius: 999,
    background: accent ? `${accent}22` : T.bgChip, color: accent || T.text,
    border: `1px solid ${accent ? `${accent}44` : 'transparent'}`,
  }}>{children}</span>
);

const PillRow = ({ items, accent }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {items.map((t, i) => <Chip key={i} accent={accent}>{prettifyTag(t)}</Chip>)}
  </div>
);

const KVTable = ({ rows }) => (
  <div style={{ background: T.bgInner, borderRadius: 8, padding: '4px 0', border: `1px solid ${T.border}` }}>
    {rows.filter(([, v]) => v).map(([k, v], i, arr) => (
      <div key={i} style={{
        display: 'grid', gridTemplateColumns: '90px 1fr', columnGap: 12,
        padding: '10px 14px',
        borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none',
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
      gap: 10, background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 12, color: p.fg, marginBottom: 12,
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
  if (mapsUrl) buttons.push({ key: 'directions', label: 'Directions', icon: '🧭', href: mapsUrl, kind: 'primary' });

  // Buy now: only when a verified buyUrl exists
  if (product?.buyUrl) buttons.push({ key: 'buy', label: 'Buy now', icon: '🛒', href: product.buyUrl, kind: 'primary' });

  // Get tickets
  if (event?.ticketUrl) buttons.push({ key: 'tickets', label: 'Get tickets', icon: '🎟', href: event.ticketUrl, kind: 'primary' });

  // Trip planning: travel/experience categories OR an itinerary OR a non-store place
  const isTripContext = itinerary || (place && ['travel', 'experience'].includes(cat));
  if (isTripContext) {
    buttons.push({ key: 'plan',  label: 'Plan trip', icon: '🗓', onClick: () => onIntent('planned'), kind: 'secondary' });
    buttons.push({ key: 'stays', label: 'Find stays', icon: '🏨', href: `https://www.google.com/travel/hotels?q=${encodeURIComponent(itinerary?.destination || place?.name || cat)}`, kind: 'secondary' });
  }

  // Share (shopping spotlight wants this prominent)
  buttons.push({ key: 'share', label: 'Share', icon: '↗', onClick: onShare, kind: 'secondary' });

  // Lifecycle: tried/visited/attended with dynamic label
  const triedLabel = cat === 'travel'      ? (intentStatus === 'tried' ? '✓ Visited'  : 'Mark visited')
                   : cat === 'experience'  ? (intentStatus === 'tried' ? '✓ Attended' : 'Mark attended')
                   :                          (intentStatus === 'tried' ? '✓ Tried'    : 'Mark tried');
  buttons.push({
    key: 'tried', label: triedLabel, icon: intentStatus === 'tried' ? '' : '○',
    onClick: () => onIntent(intentStatus === 'tried' ? 'saved' : 'tried'),
    kind: intentStatus === 'tried' ? 'primary' : 'secondary',
  });

  // Open source fallback (only if no other primary)
  if (save?.url && !buttons.find((b) => b.kind === 'primary')) {
    buttons.unshift({ key: 'source', label: 'Open source', icon: '↗', onClick: onOpenSource, kind: 'primary' });
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
      {buttons.map((b) => {
        const style = {
          flex: '1 1 calc(50% - 4px)', minWidth: 120,
          padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', textAlign: 'center',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: b.kind === 'primary' ? T.text : T.bgInner,
          color:      b.kind === 'primary' ? T.bg   : T.text,
          border:     b.kind === 'primary' ? 'none' : `1px solid ${T.border}`,
          textDecoration: 'none',
        };
        if (b.href) {
          return <a key={b.key} href={b.href} target="_blank" rel="noreferrer" style={style}><span>{b.icon}</span><span>{b.label}</span></a>;
        }
        return <button key={b.key} onClick={b.onClick} style={style}><span>{b.icon}</span><span>{b.label}</span></button>;
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
        if (detail.status !== 'success') throw new Error(detail.error?.message || 'Not found');
        setSave(detail.data);
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
  }, [id]);

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

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.retrySave(id);
      if (res?.status === 'success') setSave(res.data);
    } finally { setRetrying(false); }
  };

  const handleShare = async () => {
    if (!save?.url) { showToast('Nothing to share'); return; }
    if (navigator.share) {
      try { await navigator.share({ title: save.title, url: save.url }); return; } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(save.url); showToast('Link copied'); return; } catch {}
    }
    showToast('Sharing not supported');
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 18px 80px' }}>
        {/* Top nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'transparent', border: 0, color: T.text, fontSize: 20, cursor: 'pointer' }}>←</button>
          <span style={{ fontSize: 14, color: T.textMuted, letterSpacing: '0.04em' }}>SAVE</span>
          <button onClick={() => setConfirmDelete(true)} style={{ background: 'transparent', border: 0, color: T.redFg, fontSize: 18, cursor: 'pointer' }}>🗑</button>
        </div>

        {/* Hero / static thumbnail */}
        <div style={{ borderRadius: 14, marginBottom: 12, overflow: 'hidden', background: '#000', aspectRatio: '16 / 11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(save?.thumbnail || save?.image)
            ? <SmartImage saveId={save._id} src={save.thumbnail || save.image} alt={safeTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: T.textFaint, fontSize: 36 }}>▢</span>}
        </div>

        {/* Status messages: only show if data is missing */}
        {(() => {
          const hasGoodData = save?.aiAnalysis?.summary || (save?.aiAnalysis?.keyPoints?.length > 0);

          if (save?.processingStatus === 'partial') {
            // If partial but has good data, don't show warning
            if (hasGoodData) return null;
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

          if (save?.processingStatus === 'failed') {
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
                Could not process this save fully.
              </WarningBanner>
            );
          }

          if (save?.processingStatus === 'processing') {
            return (
              <WarningBanner tone="amber">⏳ Still processing — refresh in a moment.</WarningBanner>
            );
          }

          return null;
        })()}

        <CardHeader save={save} />

        <h2 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, margin: '0 0 8px', color: T.text }}>{safeTitle}</h2>

        {safeSummary && (
          <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5, marginBottom: 12 }}>{safeSummary}</p>
        )}
        {showRawDescription && (
          <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginBottom: 12 }}>{save.description}</p>
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
          <div style={{ background: T.bgInner, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint, margin: '0 0 8px' }}>Key points</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {save.aiAnalysis.keyPoints.map((kp, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: meta.accent, marginTop: 8 }} />
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
          <div style={{ background: T.bgInner, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
            {(recipe.cookingTime || recipe.servings || recipe.cuisine) && (
              <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
                {recipe.cookingTime ? `⏱ ${recipe.cookingTime}` : ''}
                {recipe.servings ? ` · 🍽 ${recipe.servings}` : ''}
                {recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
              </p>
            )}
            {recipe.ingredients?.length > 0 && (
              <>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint, margin: '4px 0 8px' }}>Ingredients</p>
                <PillRow items={recipe.ingredients} accent={meta.accent} />
              </>
            )}
            {recipe.steps?.length > 0 && (
              <>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint, margin: '14px 0 8px' }}>Steps</p>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recipe.steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                        background: meta.accent, color: T.bg,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.55, paddingTop: 3, color: T.text }}>{s}</span>
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
          <details open style={{ marginTop: 14, fontSize: 13, color: T.text }}>
            <summary style={{ cursor: 'pointer', color: T.textMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>📝 Transcript</span>
              {transcriptLang && transcriptLang !== 'en' && (
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: T.bgChip, color: T.textMuted }}>
                  translated from {transcriptLang}
                </span>
              )}
            </summary>
            <p style={{ padding: 12, background: T.bgInner, border: `1px solid ${T.border}`, borderRadius: 8, marginTop: 6, lineHeight: 1.55 }}>{transcript}</p>
          </details>
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
            <div style={{ background: T.bgInner, borderRadius: 10, border: `1px solid ${T.border}` }}>
              {recs.slice(0, 3).map((r, i, arr) => {
                const pct = Math.round((r.score || 0) * 100);
                return (
                  <div key={r._id}
                       style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}
                       onClick={() => onNavigate('save-detail', { id: r._id })}>
                    <span style={{ fontSize: 13, flex: 1, color: T.text }}>{r.title}</span>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: T.bgChip, color: T.textMuted, whiteSpace: 'nowrap', marginLeft: 8 }}>{pct}% match</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bgInner, color: T.text, borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, border: `1px solid ${T.border}` }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ fontSize: 20, color: T.redFg }}>🗑</span>
            </div>
            <h3 style={{ fontSize: 17, textAlign: 'center', marginBottom: 6, fontWeight: 600 }}>Delete this save?</h3>
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginBottom: 16 }}>
              It will be removed from your feed and any collections. This can't be undone.
            </p>
            {deleteError && <p style={{ color: T.redFg, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{deleteError}</p>}
            <button onClick={handleDelete} disabled={deleting}
                    style={{ width: '100%', padding: '10px 0', background: T.redFg, color: '#fff', border: 0, borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                    style={{ width: '100%', padding: '10px 0', background: 'transparent', color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, marginTop: 8, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
