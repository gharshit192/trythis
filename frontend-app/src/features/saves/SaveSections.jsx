import { useState } from 'react';
import SectionLabel from '../../components/SectionLabel';
import Icon from '../../components/Icon';

// Everything the pipeline extracted, rendered in the design's vocabulary:
// key points, then the type-specific block (recipe / product / event / place /
// itinerary), then the transcript. Each block renders only when it has data.
const looksHallucinated = (text) => {
  if (!text || text.length < 30) return false;
  if (/(.{3,})\1{4,}/.test(text)) return true;
  const words = text.split(/\s+/);
  if (words.length < 12) return false;
  return new Set(words.map((w) => w.toLowerCase())).size / words.length < 0.3;
};
const money = (n, cur) => n == null ? null : `${!cur || cur === 'INR' ? '₹' : cur + ' '}${Number(n).toLocaleString('en-IN')}`;
const LANG = { hi: 'Hindi', en: 'English', pa: 'Punjabi', mr: 'Marathi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam' };

function Facts({ items }) {
  const list = items.filter(([, v]) => v);
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {list.map(([k, v]) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 11px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--faint)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', fontSize: 10.5 }}>{k}</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}
function Rows({ label, items, numbered }) {
  if (!items?.length) return null;
  return (
    <section style={{ marginBottom: 20 }}>
      <SectionLabel>{label}</SectionLabel>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((t, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, width: 22, color: numbered ? 'var(--teal)' : 'var(--faint)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{numbered ? i + 1 : '•'}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function SaveSections({ save, hideKeyPoints, hideItinerary }) {
  const [openTranscript, setOpenTranscript] = useState(false);
  const ai = save?.aiAnalysis || {};
  const sd = ai.structuredData || {};
  const { recipe, product, event, place, itinerary } = sd;
  const points = (ai.keyPoints || []).filter((k) => k && !looksHallucinated(k));
  const t = ai.transcription || {};
  const transcript = t.text && !looksHallucinated(t.text) ? t.text : null;
  const code = String(t.detectedLanguage || '').toLowerCase().slice(0, 2);
  const langName = code && code !== 'en' ? (LANG[code] || t.detectedLanguage) : null;
  // Devanagari on screen means the original; Latin text for a Hindi reel means it was translated.
  const translated = langName && transcript && !/[\u0900-\u097F]/.test(transcript);
  const lang = langName ? `${langName}${translated ? ', translated' : ''}` : null;

  return (
    <>
      {!hideKeyPoints && <Rows label="Key points" items={points.slice(0, 8)} />}

      {recipe?.isRecipe && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>{recipe.title && recipe.title !== save.title ? recipe.title : 'Recipe'}</SectionLabel>
          <div style={{ marginTop: 10 }}><Facts items={[['Time', recipe.cookingTime], ['Serves', recipe.servings], ['Cuisine', recipe.cuisine]]} /></div>
          <Rows label={`${(recipe.ingredients || []).length} ingredients`} items={recipe.ingredients} />
          <Rows label="Steps" items={recipe.steps} numbered />
        </section>
      )}

      {product && (product.name || product.price != null || product.buyUrl) && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Product</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <Facts items={[['Brand', product.brand], ['Price', money(product.price, product.currency)], ['Was', product.lastPrice != null && product.lastPrice !== product.price ? money(product.lastPrice, product.currency) : null]]} />
          </div>
          {(product.availableItems || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 6 }}>
              {product.availableItems.slice(0, 12).map((v) => <span key={v} className="wt-chip sm" style={{ cursor: 'default', fontSize: 12.5 }}>{v}</span>)}
            </div>
          )}
          {ai.flags?.buyUrlStripped && <p style={{ fontSize: 13, color: 'var(--mute)', margin: '6px 0 0' }}>The buy link was removed — it couldn't be verified against the original.</p>}
        </section>
      )}

      {event && (event.eventName || event.venue || event.eventDate) && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Event</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <Facts items={[['When', event.eventDate ? new Date(event.eventDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null], ['Where', event.venue], ['Tickets', money(event.price, event.currency)]]} />
          </div>
        </section>
      )}

      {place && (place.address || place.cuisine || place.priceRange) && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>The place</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <Facts items={[['Cuisine', place.cuisine], ['Price', place.priceRange]]} />
          </div>
          {place.address && <p style={{ fontSize: 14.5, color: 'var(--mute)', margin: 0, lineHeight: 1.5 }}>{place.address}</p>}
          {place.bookingUrl && <a href={place.bookingUrl} target="_blank" rel="noreferrer" className="wt-link" style={{ fontSize: 13.5, display: 'inline-block', marginTop: 8, textDecoration: 'none' }}>Book a table</a>}
        </section>
      )}

      {!hideItinerary && itinerary && (itinerary.highlights?.length || itinerary.perDestinationCosts?.length) && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ marginTop: 4 }}><Facts items={[['Days', itinerary.duration], ['Budget', itinerary.estimatedCost], ['Best in', itinerary.bestSeason]]} /></div>
          <Rows label="Highlights" items={itinerary.highlights} />
          {(itinerary.perDestinationCosts || []).length > 0 && (
            <Rows label="Costs" items={itinerary.perDestinationCosts.map((c) => [c.destination, c.cost, c.notes].filter(Boolean).join(' — '))} />
          )}
        </section>
      )}

      {transcript && (
        <section style={{ marginBottom: 20 }}>
          <button type="button" onClick={() => setOpenTranscript((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
            <SectionLabel>{save?.source === 'voice' ? 'What you said' : 'What the reel said'}{lang ? ` · ${lang}` : ''}</SectionLabel>
            <span style={{ color: 'var(--faint)', transform: openTranscript ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><Icon name="forward" size={16} /></span>
          </button>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--mute)', margin: '6px 0 0', ...(openTranscript ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>{transcript}</p>
        </section>
      )}
    </>
  );
}
