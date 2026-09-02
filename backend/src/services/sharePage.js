// The public share page, in the app's own vocabulary (ADR 0012 tokens): the
// person you share with sees the recipe, the plan, the place the way you do —
// eyebrow, serif title, fact chips, numbered steps, day-by-day legs — not a
// grey card with three bullets. Server-rendered so the link previews fast and
// needs no login; every string is escaped.
const esc = (t) => (t == null ? '' : String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'));

const KIND = {
  cafe: 'place', cafes: 'place', travel: 'place', experience: 'place', experiences: 'place', hotel: 'place', hotels: 'place', events: 'place', place: 'place',
  restaurant: 'food', restaurants: 'food', food: 'food', street_food: 'food', recipe: 'food', recipes: 'food', cooking: 'food',
  market: 'shop', shopping: 'shop', fashion: 'shop', 'home-decor': 'shop', beauty: 'shop', products: 'shop', product: 'shop',
  tech: 'learn', blog: 'learn', article: 'learn', learning: 'learn', book: 'learn', film: 'learn', movie: 'learn', show: 'learn', entertainment: 'learn', productivity: 'learn', fitness: 'learn',
};
const LABEL = {
  cafe: 'Cafe', cafes: 'Cafe', restaurant: 'Restaurant', restaurants: 'Restaurant', food: 'Food', street_food: 'Street food', recipe: 'Recipe', recipes: 'Recipe', cooking: 'Recipe',
  travel: 'Trip', experience: 'Experience', experiences: 'Experience', hotel: 'Stay', hotels: 'Stay', events: 'Event', market: 'Market', shopping: 'Shop', fashion: 'Fashion',
  'home-decor': 'Home', beauty: 'Beauty', tech: 'Tech', blog: 'Article', article: 'Article', learning: 'Learn', book: 'Book', film: 'Film', movie: 'Film', show: 'Show',
  entertainment: 'Watch', productivity: 'Learn', fitness: 'Fitness', products: 'Product', product: 'Product',
};
const HUE = { place: '#0E7C7B', food: '#C99425', shop: '#8B5E3C', learn: '#6B5B95', none: '#6E7B78' };
const LANG = { hi: 'Hindi', en: 'English', pa: 'Punjabi', mr: 'Marathi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam' };

const money = (n, cur) => (n == null ? null : `${!cur || cur === 'INR' ? '₹' : `${cur} `}${Number(n).toLocaleString('en-IN')}`);
const day = (d, opts = { day: 'numeric', month: 'short' }) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : null);
const looksHallucinated = (text) => {
  if (!text || text.length < 30) return false;
  if (/(.{3,})\1{4,}/.test(text)) return true;
  const words = text.split(/\s+/);
  return words.length >= 12 && new Set(words.map((w) => w.toLowerCase())).size / words.length < 0.3;
};

const label = (t) => `<div class="lbl">${esc(t)}</div>`;
const facts = (pairs) => {
  const xs = pairs.filter(([, v]) => v != null && v !== '');
  return xs.length ? `<div class="facts">${xs.map(([k, v]) => `<span class="fact"><b>${esc(k)}</b>${esc(v)}</span>`).join('')}</div>` : '';
};
const rows = (title, items, numbered) => {
  const xs = (items || []).filter(Boolean);
  if (!xs.length) return '';
  return `<section>${label(title)}<ol class="rows${numbered ? ' num' : ''}">${xs.map((x, i) => `<li><span class="n">${numbered ? i + 1 : '•'}</span><span>${esc(x)}</span></li>`).join('')}</ol></section>`;
};

const tripHtml = (save, it) => {
  const dur = (String(it.duration || '').match(/(\d+)\s*(day|night|d\b)/i) || [])[1];
  const short = (s = '') => String(s).replace(/^(approx\.?|around|about)\s*/i, '').slice(0, 14);
  const legs = it.highlights || [];
  const costs = it.perDestinationCosts || [];
  return `<div class="stats">
      <div class="stat"><span class="k">Days</span><span class="v">${esc(dur || '—')}</span></div>
      <div class="stat"><span class="k">Budget</span><span class="v">${esc(it.estimatedCost ? short(it.estimatedCost) : '—')}</span></div>
      <div class="stat"><span class="k">Best in</span><span class="v">${esc(it.bestSeason ? short(it.bestSeason) : '—')}</span></div>
    </div>
    ${legs.length ? `<section>${label(save.source === 'voice' ? `${legs.length} leg${legs.length === 1 ? '' : 's'}, as ${esc(save.sharerName || 'they')} said them` : `${legs.length} place${legs.length === 1 ? '' : 's'}, from the reel`)}<ol class="rows legs">${legs.map((h) => {
      const c = costs.find((x) => x.destination === h)?.cost;
      return `<li><span class="dot" style="background:${/(thali|food|cafe|eat|restaurant|breakfast|dinner)/i.test(h) ? HUE.food : HUE.place}"></span><span class="grow">${esc(h)}</span>${c ? `<span class="cost">${esc(c)}</span>` : ''}</li>`;
    }).join('')}</ol></section>` : ''}`;
};

const planHtml = (plan) => {
  if (!plan?.dailyPlan?.length) return '';
  const days = plan.dailyPlan.map((d) => `<div class="day"><div class="dayhead"><span class="daynum">Day ${esc(d.day)}</span><span class="daytheme">${esc(d.theme || '')}</span>${d.stayArea ? `<span class="stay">stay: ${esc(d.stayArea)}</span>` : ''}</div>
      <ol class="rows">${(d.stops || []).map((x) => `<li><span class="n">•</span><span>${esc(x.place)}${x.notes ? ` <span class="note">— ${esc(x.notes)}</span>` : ''}</span></li>`).join('')}</ol></div>`).join('');
  const link = (x, text) => `<li><span class="n">↗</span><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(text)}</a></li>`;
  const stays = (plan.destinations || []).flatMap((d) => (d.stays || []).map((x) => link(x, `${x.provider}${x.tier ? ` — ${x.tier}` : ''} · ${d.name}`)));
  const there = (plan.destinations || []).flatMap((d) => (d.gettingThere || []).map((x) => link(x, `${x.mode}${x.provider ? ` via ${x.provider}` : ''} · ${d.name}`)));
  return `<section>${label(plan.tripTitle || 'Day by day')}${facts([['Budget', plan.estimatedBudgetInr ? `about ₹${Number(plan.estimatedBudgetInr).toLocaleString('en-IN')}` : null], ['Days', plan.dailyPlan.length]])}${days}</section>
    ${stays.length ? `<section>${label('Stays')}<ol class="rows">${stays.join('')}</ol></section>` : ''}
    ${there.length ? `<section>${label('Getting there')}<ol class="rows">${there.join('')}</ol></section>` : ''}`;
};

function renderSharePage({ save, shareId, sharer, shareUrl, app }) {
  const ai = save.aiAnalysis || {};
  const sd = ai.structuredData || {};
  const kind = KIND[save.category] || 'none';
  const hue = HUE[kind];
  const catLabel = save.source === 'voice' && save.memoryType === 'plan' ? 'Trip' : (LABEL[save.category] || (save.source === 'voice' ? 'Note' : 'Save'));
  const city = save.extractedLocation?.city || save.extractedLocation?.name || save.entities?.place;
  const isTrip = !!(sd.itinerary && (sd.itinerary.highlights?.length || sd.itinerary.destination));
  const points = (ai.keyPoints || []).filter((k) => k && !looksHallucinated(k)).slice(0, 10);
  const r = sd.recipe; const p = sd.product; const e = sd.event; const pl = sd.place;
  const t = ai.transcription || {};
  const transcript = t.text && !looksHallucinated(t.text) ? t.text : null;
  const code = String(t.detectedLanguage || '').toLowerCase().slice(0, 2);
  const lang = code && code !== 'en' ? (LANG[code] || t.detectedLanguage) : null;
  const tags = [...new Set([...(save.tags || []), ...(ai.audioTags || [])])].filter(Boolean).slice(0, 6);
  const maps = pl?.address || city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([save.extractedLocation?.name, pl?.address || city].filter(Boolean).join(', '))}` : null;
  const meta = [save.plannedFor ? `Planned for ${day(save.plannedFor, { weekday: 'long', day: 'numeric', month: 'short' })}` : null, `Saved ${day(save.createdAt)}`, save.intentStatus === 'tried' ? `Tried${save.rating ? ` · ${'★'.repeat(save.rating)}` : ''}` : null].filter(Boolean).join(' · ');
  save.sharerName = sharer;

  const title = esc(save.title || 'Untitled');
  const description = esc(ai.summary || save.description || 'Saved on Wanna Try');
  const body = `
    ${ai.summary ? `<p class="summary">${esc(ai.summary)}</p>` : (save.description && !isTrip ? `<p class="summary">${esc(save.description.slice(0, 500))}</p>` : '')}
    ${isTrip ? tripHtml(save, sd.itinerary) : ''}
    ${rows('Key points', points)}
    ${r?.isRecipe ? `<section>${label(r.title && r.title !== save.title ? r.title : 'Recipe')}${facts([['Time', r.cookingTime], ['Serves', r.servings], ['Cuisine', r.cuisine]])}${rows(`${(r.ingredients || []).length} ingredients`, r.ingredients)}${rows('Steps', r.steps, true)}</section>` : ''}
    ${p && (p.name || p.price != null) ? `<section>${label('Product')}${facts([['Name', p.name], ['Brand', p.brand], ['Price', money(p.price, p.currency)]])}${(p.availableItems || []).length ? `<div class="chips">${p.availableItems.slice(0, 12).map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</div>` : ''}</section>` : ''}
    ${e && (e.eventName || e.venue || e.eventDate) ? `<section>${label('Event')}${facts([['What', e.eventName], ['When', day(e.eventDate, { day: 'numeric', month: 'short', year: 'numeric' })], ['Where', e.venue], ['Tickets', money(e.price, e.currency)]])}</section>` : ''}
    ${pl && (pl.address || pl.cuisine || pl.priceRange) ? `<section>${label('The place')}${facts([['Cuisine', pl.cuisine], ['Price', pl.priceRange]])}${pl.address ? `<p class="addr">${esc(pl.address)}</p>` : ''}</section>` : ''}
    ${isTrip && (sd.itinerary.perDestinationCosts || []).length ? rows('Costs', sd.itinerary.perDestinationCosts.map((c) => [c.destination, c.cost, c.notes].filter(Boolean).join(' — '))) : ''}
    ${planHtml(save.tripPlan?.data)}
    ${save.source === 'voice' && (save.entities?.people?.length || save.entities?.topic) ? `<section>${label('From a voice note')}${facts([['Who', (save.entities.people || []).join(', ')], ['Where', save.entities.place], ['About', save.entities.topic]])}</section>` : ''}
    ${transcript ? `<section>${label(`${save.source === 'voice' ? 'What they said' : 'What the reel said'}${lang ? ` · ${lang}${/[ऀ-ॿ]/.test(transcript) ? '' : ', translated'}` : ''}`)}<p class="transcript">${esc(transcript.slice(0, 1500))}</p></section>` : ''}
    ${tags.length ? `<div class="chips tags">${tags.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Wanna Try</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${esc(shareUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Wanna Try" />
  <meta name="twitter:card" content="summary" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Work+Sans:wght@400;500;600&display=swap" />
  <style>
    :root { --bg:#FAF8F5; --card:#fff; --ink:#15201E; --mute:#6E7B78; --faint:#9BA5A2; --line:#E7E2DA; --teal:#0E7C7B; --teal-d:#0A5A59; --teal-soft:#E4EFEE; --sand:#E9D9BE; --hue:${hue}; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:'Work Sans',-apple-system,system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
    .wrap { max-width:560px; margin:0 auto; padding:20px 24px 40px; }
    .top { display:flex; align-items:center; justify-content:space-between; margin-bottom:26px; }
    .brand { font-family:'DM Serif Display',Georgia,serif; font-size:20px; color:var(--teal-d); text-decoration:none; }
    .by { font-size:12.5px; color:var(--faint); }
    .eyebrow { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
    .eyebrow .dot { width:8px; height:8px; border-radius:4px; background:var(--hue); }
    .eyebrow .cat { font-size:12px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--hue); }
    .eyebrow .where { font-size:12px; color:var(--faint); }
    h1 { font-family:'DM Serif Display',Georgia,serif; font-weight:400; font-size:30px; line-height:1.12; margin:0 0 10px; text-wrap:balance; }
    .meta { font-size:14.5px; color:var(--mute); margin-bottom:22px; }
    .summary { font-size:15px; line-height:1.55; color:var(--mute); margin:0 0 20px; }
    section { margin-bottom:22px; }
    .lbl { font-size:12px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin-bottom:6px; }
    .facts { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 14px; }
    .fact { display:inline-flex; align-items:center; gap:6px; font-size:13px; padding:6px 11px; border-radius:999px; background:var(--card); border:1px solid var(--line); }
    .fact b { color:var(--faint); font-weight:600; letter-spacing:.04em; text-transform:uppercase; font-size:10.5px; }
    .rows { margin:0; padding:0; list-style:none; }
    .rows li { display:flex; gap:12px; padding:9px 0; border-bottom:1px solid var(--line); font-size:15px; line-height:1.5; }
    .rows .n { flex-shrink:0; width:22px; color:var(--faint); font-weight:600; font-variant-numeric:tabular-nums; }
    .rows.num .n { color:var(--teal); }
    .rows a { color:var(--teal); text-decoration:none; font-weight:500; }
    .rows .note { color:var(--mute); }
    .legs li { align-items:center; gap:10px; padding:11px 0; }
    .legs .dot { width:7px; height:7px; border-radius:4px; flex-shrink:0; }
    .legs .grow { flex:1; }
    .legs .cost { font-size:12.5px; color:var(--faint); }
    .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:22px; }
    .stat { background:var(--card); border:1px solid var(--line); border-radius:11px; padding:12px 12px 10px; display:flex; flex-direction:column; gap:4px; }
    .stat .k { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); }
    .stat .v { font-family:'DM Serif Display',Georgia,serif; font-size:20px; }
    .day { margin-top:12px; }
    .dayhead { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-bottom:2px; }
    .daynum { font-family:'DM Serif Display',Georgia,serif; font-size:18px; }
    .daytheme { font-size:14px; color:var(--mute); }
    .stay { font-size:12px; color:var(--faint); }
    .addr { font-size:14.5px; color:var(--mute); margin:0; line-height:1.5; }
    .transcript { font-size:14.5px; line-height:1.6; color:var(--mute); margin:6px 0 0; white-space:pre-wrap; }
    .chips { display:flex; flex-wrap:wrap; gap:7px; }
    .chips.tags { margin:4px 0 24px; }
    .chip { font-size:12.5px; padding:6px 11px; border-radius:999px; background:var(--card); border:1px solid var(--line); color:var(--mute); }
    .cta { display:flex; flex-direction:column; gap:10px; margin-top:28px; }
    .btn { display:block; text-align:center; padding:15px; border-radius:12px; font-weight:600; text-decoration:none; font-size:16px; }
    .btn.p { background:var(--teal); color:#fff; }
    .btn.s { background:var(--card); border:1px solid var(--line); color:var(--ink); font-weight:500; font-size:15px; padding:14px; }
    .foot { text-align:center; font-size:12.5px; color:var(--faint); margin:8px 0 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top"><a class="brand" href="${esc(app)}">Wanna Try</a><span class="by">Shared by ${esc(sharer)}</span></div>
    <div class="eyebrow"><span class="dot"></span><span class="cat">${esc(catLabel)}</span>${city ? `<span class="where">· ${esc(city)}</span>` : (save.source === 'voice' ? '<span class="where">· from a voice note</span>' : '')}</div>
    <h1>${title}</h1>
    <div class="meta">${esc(meta)}</div>
    ${body}
    <div class="cta">
      ${maps ? `<a class="btn s" href="${esc(maps)}" target="_blank" rel="noopener">Directions</a>` : (save.url ? `<a class="btn s" href="${esc(save.url)}" target="_blank" rel="noopener">See the original</a>` : '')}
      <a class="btn p" href="${esc(app)}/?open=${esc(shareId)}">Open in Wanna Try</a>
      <a class="btn s" href="${esc(app)}/?signup=1">Create a free account</a>
      <p class="foot">Shared from Wanna Try — save it, and it comes back when you can go.</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderSharePage };
