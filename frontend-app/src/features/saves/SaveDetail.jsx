import { useEffect, useState, lazy, Suspense } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import StatusControl from '../../components/StatusControl';
import SectionLabel from '../../components/SectionLabel';
import ListRow from '../../components/ListRow';
import { getCategoryTile } from '../../lib/categoryMeta';
import { relativeTime } from '../../lib/format';
import Trip from './Trip';
import SaveSections from './SaveSections';
import ReminderControl from '../../components/ReminderControl';
import Chip from '../../components/Chip';
import { isTryable } from '../../lib/intent';

// Screenshot saves keep their own (legacy) detail until it is rebuilt.
const ScreenshotDetail = lazy(() => import('./ScreenshotDetail'));

// The item screen (ADR 0013/0015): no hero image. Eyebrow · serif title · meta ·
// status control · why you saved it · tags · source row (where the saved photo
// lives) · note · one primary action. Everything else is behind ⋯.
const looksHallucinated = (text) => {
  if (!text || text.length < 30) return false;
  if (/(.{3,})\1{4,}/.test(text)) return true;
  const words = text.split(/\s+/);
  if (words.length < 12) return false;
  return new Set(words.map((w) => w.toLowerCase())).size / words.length < 0.3;
};
const prettify = (t) => String(t).replace(/[-_]+/g, ' ').trim();
const mapsHref = (save) => {
  const p = save?.aiAnalysis?.structuredData?.place;
  if (p?.googleMapsUrl) return p.googleMapsUrl;
  if (p?.coordinates?.lat) return `https://www.google.com/maps/search/?api=1&query=${p.coordinates.lat},${p.coordinates.lng}`;
  const loc = save?.extractedLocation;
  if (loc?.lat) return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  const q = [p?.name || loc?.name, p?.address, loc?.city].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
};
const sourceLabel = (s) => ({ instagram: 'a reel', youtube: 'a video', tiktok: 'a video', web: 'an article', url: 'a link', pinterest: 'a pin', manual: 'a note', voice: 'a voice note' }[s] || 'a link');
const handleOf = (save) => save?.metadata?.authorHandle || save?.author || save?.aiAnalysis?.author || null;

// A short, opinionated starter set; 'Other…' adds anything. Tags feed search,
// Ask and (later) auto-collections.
const PRESET_TAGS = ['date night', 'weekend', 'with friends', 'family', 'solo', 'budget', 'splurge', 'quick', 'healthy', 'gift', 'work', 'must try'];

export default function SaveDetail({ onNavigate, onBack, payload }) {
  const id = payload?.id;
  const [save, setSave] = useState(null);
  const [recs, setRecs] = useState([]);
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [draftTags, setDraftTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  // List reels (brief §20): pick which of the places become your own saves.
  const [picked, setPicked] = useState(null);   // null = all selected
  const [splitting, setSplitting] = useState(false);
  const splitNow = async (places) => {
    const idx = picked === null ? places.map((_, i) => i) : [...picked];
    if (!idx.length || splitting) return;
    setSplitting(true);
    const r = await api.splitSave(id, idx).catch(() => null);
    setSplitting(false);
    if (r?.status === 'success') onNavigate('starter', { saveIds: r.data.saveIds, collectionName: r.data.collectionName });
    else flash(r?.error?.message || 'Could not save those');
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api.getSaveById(id).then((r) => {
      if (!alive) return;
      if (r?.status === 'success') { setSave(r.data); setNote(r.data?.notes || ''); }
      else if (r?.error?.message?.includes('Unauthorized')) onNavigate('login');
      else setError(r?.error?.message || 'Not found');
    });
    api.getRecommendations(id).then((r) => alive && r?.status === 'success' && setRecs(r.data || [])).catch(() => {});
    return () => { alive = false; };
  }, [id, payload?.refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  // Still being read on the server → refresh every 4 s (up to 5 min) so the
  // details appear the moment they exist.
  useEffect(() => {
    if (!save || !['pending', 'processing'].includes(save.processingStatus)) return undefined;
    let ticks = 0;
    const t = setInterval(async () => {
      ticks += 1;
      const r = await api.getSaveById(id, { force: true }).catch(() => null);
      if (r?.status === 'success') setSave(r.data);
      if (ticks > 75 || (r?.status === 'success' && !['pending', 'processing'].includes(r.data.processingStatus))) clearInterval(t);
    }, 4000);
    return () => clearInterval(t);
  }, [id, save?.processingStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (t) => { setToast(t); setTimeout(() => setToast(null), 1800); };
  const setIntent = async (next) => {
    if (next === 'tried') return onNavigate('tried', { id, title: save.title, createdAt: save.createdAt });
    const prev = save.intentStatus; setSave({ ...save, intentStatus: next });
    const r = await api.updateIntent(id, { intentStatus: next }).catch(() => null);
    if (r?.status !== 'success') setSave((s) => ({ ...s, intentStatus: prev }));
  };
  const setReminder = async (date) => {
    const r = await api.patchSave(id, { resurfaceAt: date }).catch(() => null);
    if (r?.status === 'success') { setSave(r.data); flash(date ? 'Reminder set' : 'Reminder off'); }
  };
  const setPlannedFor = async (date) => {
    const r = await api.patchSave(id, { plannedFor: date }).catch(() => null);
    if (r?.status === 'success') { setSave(r.data); flash(date ? 'Planned' : 'Plan cleared'); }
  };
  const saveNote = async () => {
    setNoteOpen(false);
    if ((save.notes || '') === note) return;
    const r = await api.patchSave(id, { notes: note }).catch(() => null);
    if (r?.status === 'success') { setSave(r.data); flash('Note saved'); }
  };
  const saveTitle = async () => {
    const title = draftTitle.trim(); setRenameOpen(false);
    if (!title || title === save.title) return;
    const r = await api.patchSave(id, { title }).catch(() => null);
    if (r?.status === 'success') { setSave(r.data); flash('Renamed'); } else flash('Could not rename');
  };
  const saveTags = async () => {
    setTagsOpen(false);
    const r = await api.patchSave(id, { tags: draftTags }).catch(() => null);
    if (r?.status === 'success') { setSave(r.data); flash('Tags saved'); } else flash('Could not save tags');
  };
  const share = async () => {
    setMenu(false); setBusy(true);
    try {
      const r = await api.shareSave(id);
      const url = r?.data?.shareUrl || r?.shareUrl;
      if (url && navigator.share) await navigator.share({ title: save.title, url });
      else if (url) { await navigator.clipboard?.writeText(url); flash('Link copied'); }
      else flash(r?.error?.message || 'Could not share');
    } catch {} finally { setBusy(false); }
  };
  const retry = async () => {
    setMenu(false);
    if (save.source === 'voice') {
      flash('Re-reading your note…');
      const r = await api.rebuildVoiceNote(id).catch(() => null);
      if (r?.status === 'success') { setSave(r.data); flash('Updated'); } else flash(r?.error?.message || 'Could not re-read');
      return;
    }
    const r = await api.retrySave(id).catch(() => null); flash(r?.status === 'success' ? 'Reading it again…' : 'Retry failed');
  };
  const remove = async () => {
    setBusy(true);
    const r = await api.deleteSave(id).catch(() => null);
    setBusy(false);
    if (r?.status === 'success') onNavigate('home', { refresh: true }); else flash('Delete failed');
  };

  if (!id) return <div className="wt-screen"><div className="wt-note error">No save selected.</div><Button small variant="secondary" onClick={() => onNavigate('home')}>Home</Button></div>;
  if (error) return <div className="wt-screen"><div className="wt-topbar"><button type="button" className="wt-iconbtn" onClick={onBack} aria-label="Back"><Icon name="back" size={22} /></button></div><div className="wt-note error">{error}</div></div>;
  if (!save) return <div className="wt-screen"><div className="wt-topbar"><button type="button" className="wt-iconbtn" onClick={onBack} aria-label="Back"><Icon name="back" size={22} /></button></div><div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--mute)', fontSize: 14 }}><span className="wt-spinner" />Opening…</div></div>;

  if (save.contentType === 'image' || save.source === 'screenshot') {
    return <Suspense fallback={<div className="wt-screen" />}><ScreenshotDetail save={save} onNavigate={onNavigate} onBack={onBack} /></Suspense>;
  }

  const sd = save.aiAnalysis?.structuredData || {};
  const tile = getCategoryTile(save.category);
  const isTravel = ['travel', 'experience', 'hotel'].includes(save.category) && (sd.itinerary?.destination || sd.itinerary?.highlights?.length);
  const tryable = isTryable(save);
  const status = tryable
    ? <StatusControl value={save.intentStatus || 'saved'} onChange={setIntent} />
    : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--card-2)', fontSize: 13.5, color: 'var(--mute)' }}>
        <Icon name="book" size={16} /><span style={{ flex: 1 }}>{save.source === 'voice' ? 'A note — keep it, set a reminder, or mark it done.' : 'A document, not a place to try — keep it, set a reminder, or mark it done.'}</span>
        <button type="button" onClick={() => setIntent(save.intentStatus === 'dismissed' ? 'saved' : 'dismissed')} style={{ background: 'none', border: 0, color: 'var(--teal)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{save.intentStatus === 'dismissed' ? 'Keep' : 'Done'}</button>
      </div>
    );
  const menuSheet = menu && (
    <div className="wt-sheet" onClick={() => setMenu(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <button type="button" className="wt-menu-row" onClick={share}><Icon name="share" size={20} />Share</button>
        <button type="button" className="wt-menu-row" onClick={() => { setMenu(false); setDraftTitle(save.title || ''); setRenameOpen(true); }}><Icon name="edit" size={20} />Rename</button>
        <button type="button" className="wt-menu-row" onClick={() => { setMenu(false); setDraftTags(save.tags || []); setTagsOpen(true); }}><Icon name="folder" size={20} />Edit tags</button>
        {save.url && <a className="wt-menu-row" href={save.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Icon name="link" size={20} />Open the original</a>}
        {(save.processingStatus === 'failed' || save.processingStatus === 'partial' || save.source === 'voice') && <button type="button" className="wt-menu-row" onClick={retry}><Icon name="sparkle" size={20} />Read it again</button>}
        <button type="button" className="wt-menu-row danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}><Icon name="close" size={20} />Delete</button>
      </div>
    </div>
  );
  const renameSheet = renameOpen && (
    <div className="wt-sheet" onClick={() => setRenameOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 12px' }}>Rename</p>
        <input className="wt-input" autoFocus value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={140} style={{ marginBottom: 12 }} onKeyDown={(e) => e.key === 'Enter' && saveTitle()} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Button small variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button small onClick={saveTitle} disabled={!draftTitle.trim() || draftTitle.trim() === save.title}>Save</Button>
        </div>
      </div>
    </div>
  );
  const tagsSheet = tagsOpen && (
    <div className="wt-sheet" onClick={() => setTagsOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 4px' }}>Tags</p>
        <p className="wt-sub" style={{ marginBottom: 14 }}>A few that help you find it later. Pick, or add your own.</p>
        <div className="wt-chips" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          {[...new Set([...PRESET_TAGS, ...draftTags])].map((t) => <Chip key={t} small on={draftTags.includes(t)} onClick={() => setDraftTags((xs) => xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t])}>{t}</Chip>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const t = customTag.trim().toLowerCase().replace(/^#/, '').slice(0, 24); if (t && !draftTags.includes(t)) setDraftTags((xs) => [...xs, t]); setCustomTag(''); }} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="wt-input" value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Other…" style={{ flex: 1 }} />
          <Button small variant="secondary" type="submit" disabled={!customTag.trim()} style={{ width: 'auto', padding: '0 16px' }}>Add</Button>
        </form>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button small variant="secondary" onClick={() => setTagsOpen(false)}>Cancel</Button>
          <Button small onClick={saveTags}>Save tags</Button>
        </div>
      </div>
    </div>
  );
  const deleteSheet = confirmDelete && (
    <div className="wt-sheet" onClick={() => setConfirmDelete(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px' }}>Delete this save?</p>
        <p className="wt-sub" style={{ marginBottom: 18 }}>It goes for good. The original reel stays where it is.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button small variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button small onClick={remove} disabled={busy} style={{ background: '#A6392F' }}>Delete</Button>
        </div>
      </div>
    </div>
  );

  if (isTravel) {
    return <>{menuSheet}{deleteSheet}{renameSheet}{tagsSheet}<Trip save={save} onNavigate={onNavigate} onBack={onBack} onMore={() => setMenu(true)} onShare={share} statusControl={status} /></>;
  }

  const summary = save.aiAnalysis?.summary && !looksHallucinated(save.aiAnalysis.summary) ? save.aiAnalysis.summary : (save.description && !looksHallucinated(save.description) ? save.description : null);
  const title = save.title && !looksHallucinated(save.title) ? save.title : 'Untitled save';
  const where = [save.extractedLocation?.name, save.extractedLocation?.city].filter(Boolean).join(', ');
  const price = sd.place?.priceRange || (sd.product?.price ? `${sd.product.currency === 'INR' || !sd.product.currency ? '₹' : sd.product.currency + ' '}${sd.product.price}` : null);
  const meta = [save.distanceMetres != null ? `${(save.distanceMetres / 1000).toFixed(1)} km` : null, price, sd.event?.eventDate ? new Date(sd.event.eventDate).toLocaleDateString() : null].filter(Boolean).join(' · ');
  const tags = [...new Set([...(save.tags || []), ...(save.aiAnalysis?.audioTags || [])].map(prettify).filter(Boolean))].slice(0, 6);
  const maps = mapsHref(save);
  const primary = maps ? { label: 'Directions', icon: 'pin', href: maps }
    : sd.product?.buyUrl ? { label: 'Buy', icon: 'bag', href: sd.product.buyUrl }
    : sd.event?.ticketUrl ? { label: 'Tickets', icon: 'calendar', href: sd.event.ticketUrl }
    : sd.recipe?.isRecipe ? { label: 'Cook this', icon: 'pot', onClick: () => setNoteOpen(true) }
    : save.url ? { label: 'Open', icon: 'link', href: save.url } : null;
  const handle = handleOf(save);
  const whyLine = (() => {
    const me = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const pr = me.preferences || {}; const interests = me.interests || [];
    const kind = tile.kind; const bits = [];
    const INT = { cafes: ['cafe'], street_food: ['street_food', 'food'], restaurants: ['restaurant'], trips: ['travel', 'hotel'], recipes: ['recipe', 'cooking'], shopping: ['shopping', 'home-decor'], fashion: ['fashion', 'beauty'], films: ['film', 'movie', 'show'], books: ['book'], experiences: ['experience'], fitness: ['fitness'], gadgets: ['tech'] };
    const hit = interests.find((i) => (INT[i] || []).includes(save.category));
    if (hit) bits.push(`you said you want more ${hit.replace('_', ' ')}`);
    const price = sd.place?.priceRange || (sd.product?.price ? `₹${sd.product.price}` : null);
    const n = price ? parseInt(String(price).replace(/[^0-9]/g, ''), 10) : NaN;
    if (pr.budget === 'low' && n && n <= 500) bits.push('it fits your budget');
    if (pr.budget === 'high' && n && n >= 1500) bits.push("it's the kind of splurge you like");
    const text = [save.title, save.aiAnalysis?.summary, ...(save.tags || []), ...(save.aiAnalysis?.keyPoints || [])].join(' ').toLowerCase();
    if (pr.diet === 'veg' && /\bveg|vegetarian|paneer|dal\b/.test(text) && !/non-veg|chicken|mutton/.test(text)) bits.push("it's veg-friendly");
    if (pr.company === 'friends' && /group|friends|table for|sharing|party/.test(text)) bits.push('it works for a group');
    if (pr.company === 'partner' && /date|romantic|rooftop|sunset|candle/.test(text)) bits.push('it reads like a date');
    if ((pr.vibes || []).includes('hidden-gems') && /hidden|secret|lesser.known|quiet/.test(text)) bits.push("it's a quiet one");
    if ((pr.vibes || []).includes('adventurous') && /trek|hike|kayak|camp|climb/.test(text)) bits.push("it's your kind of adventure");
    if (!bits.length && kind === 'place' && me.location?.city && save.extractedLocation?.city && me.location.city.toLowerCase().includes(save.extractedLocation.city.toLowerCase().split(' ')[0])) bits.push("it's in your city");
    if (!bits.length) return null;
    const line = bits.slice(0, 2).join(', and ');
    return line.charAt(0).toUpperCase() + line.slice(1) + '.';
  })();
  const processing = ['pending', 'processing', 'failed', 'partial'].includes(save.processingStatus);

  return (
    <div className="wt-screen">
      {menuSheet}{deleteSheet}{renameSheet}{tagsSheet}
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '9px 14px', borderRadius: 10, fontSize: 13.5, zIndex: 70 }}>{toast}</div>}

      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <div className="acts">
          <button type="button" className="wt-iconbtn" aria-label="Share" onClick={share}><Icon name="share" size={21} /></button>
          <button type="button" className="wt-iconbtn" aria-label="More" onClick={() => setMenu(true)}><Icon name="more" size={21} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--cat-${tile.kind})` }} />
        <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em', color: `var(--cat-${tile.kind})` }}>{tile.label}</span>
        {where && <span style={{ fontSize: 12, color: 'var(--faint)' }}>· {where}</span>}
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 10 }}>{title}</h1>
      <div style={{ fontSize: 14.5, color: 'var(--mute)', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{meta || `Saved ${relativeTime(save.createdAt).toLowerCase()}`}</span>
        {processing && <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: 'var(--teal-soft)', color: 'var(--teal-d)' }}>{save.processingStatus === 'failed' ? 'Couldn\'t read it' : save.processingStatus === 'partial' ? 'Partly read' : 'Still reading'}</span>}
      </div>

      <div style={{ marginBottom: save.intentStatus === 'planned' && tryable ? 12 : 24 }}>{status}</div>
      {tryable && save.intentStatus === 'planned' && (
        <div style={{ marginBottom: 24, padding: '13px 14px', borderRadius: 12, background: 'var(--teal-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--teal)' }}>When?</span>
          {save.plannedFor && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--teal-d)' }}>{new Date(save.plannedFor).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}<span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--teal)' }}>We'll remind you that morning.</span></span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[['This weekend', (() => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d; })()], ['Next week', (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })()]].map(([label, d]) => (
              <Chip key={label} small onClick={() => setPlannedFor(d.toISOString())}>{label}</Chip>
            ))}
            <label className="wt-chip sm" style={{ position: 'relative', overflow: 'hidden' }}>Pick a date<input type="date" onChange={(e) => e.target.value && setPlannedFor(new Date(`${e.target.value}T09:00:00`).toISOString())} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} /></label>
            {save.plannedFor && <Chip small onClick={() => setPlannedFor(null)}>Clear</Chip>}
          </div>
        </div>
      )}

      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          <SectionLabel>Why you saved it</SectionLabel>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>{summary}</p>
        </div>
      )}
      {(save.aiAnalysis?.places || []).length >= 2 && !save.metadata?.splitAt && (() => { const places = save.aiAnalysis.places; const sel = picked === null ? new Set(places.map((_, i) => i)) : picked; return (
        <section style={{ marginBottom: 24, padding: '14px 14px 12px', borderRadius: 14, background: 'var(--teal-soft)' }}>
          <SectionLabel>We found {places.length} places in this reel</SectionLabel>
          <p style={{ fontSize: 13.5, color: 'var(--teal-d)', margin: '4px 0 10px' }}>Each one you keep becomes its own save — with nearby, reminders and Ask.</p>
          {places.map((p, i) => (
            <button key={i} type="button" onClick={() => setPicked((cur) => { const n = new Set(cur === null ? places.map((_, k) => k) : cur); n.has(i) ? n.delete(i) : n.add(i); return n; })}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', padding: '9px 0', border: 0, borderBottom: '1px solid rgba(14,124,123,.15)', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${sel.has(i) ? 'var(--teal)' : 'var(--faint)'}`, background: sel.has(i) ? 'var(--teal)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{sel.has(i) && <Icon name="check" size={14} stroke={2.5} />}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontSize: 13, color: 'var(--mute)' }}>{[p.area || p.city, p.whatFor, p.price].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Button small onClick={() => splitNow(places)} disabled={splitting || sel.size === 0}>{splitting ? 'Saving…' : `Save ${sel.size === places.length ? 'all' : sel.size}`}</Button>
            <Button small variant="secondary" onClick={() => setPicked(sel.size === places.length ? new Set() : null)} style={{ width: 'auto', padding: '0 14px' }}>{sel.size === places.length ? 'None' : 'All'}</Button>
          </div>
        </section>); })()}
      {save.metadata?.splitAt && <div className="wt-note info" style={{ marginBottom: 20 }}>{save.metadata.splitCount || ''} place{save.metadata.splitCount === 1 ? '' : 's'} from this reel are in your list{save.metadata.listOf ? ` (${save.metadata.listOf} found)` : ''}.</div>}
      {whyLine && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 22, fontSize: 14.5, lineHeight: 1.45, color: 'var(--teal-d)' }}>
          <span style={{ color: 'var(--cat-food)', flexShrink: 0, marginTop: 2 }}><Icon name="star" size={16} /></span>
          <span><b style={{ fontWeight: 600 }}>Why you might like it.</b> {whyLine}</span>
        </div>
      )}
      <SaveSections save={save} />
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
          {tags.map((t) => <span key={t} className="wt-chip sm" style={{ cursor: 'default', fontSize: 12.5 }}>{t}</span>)}
        </div>
      )}

      {/* Source row — where the saved image lives. Never shown as a hero. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', marginBottom: 10 }}>
        <span style={{ color: 'var(--mute)' }}><Icon name={save.source === 'instagram' ? 'instagram' : save.source === 'youtube' ? 'play' : save.source === 'voice' ? 'mic' : 'link'} size={20} stroke={1.7} /></span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>From {sourceLabel(save.source)}{handle ? ` by @${String(handle).replace(/^@/, '')}` : ''}</span>
          <span style={{ fontSize: 12.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[relativeTime(save.createdAt), (save.thumbnail || save.image) ? 'photo saved' : null, save.aiAnalysis?.transcription?.detectedLanguage && save.aiAnalysis.transcription.detectedLanguage !== 'en' ? 'translated' : null].filter(Boolean).join(' · ')}
          </span>
        </div>
        {save.url && <a href={save.url} target="_blank" rel="noreferrer" className="wt-link" style={{ fontSize: 13, flexShrink: 0, textDecoration: 'none' }}>{save.contentType === 'video' ? 'Watch' : 'Open'}</a>}
      </div>
      <div style={{ padding: '13px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
        {noteOpen ? (
          <textarea className="wt-input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="A note for future you" style={{ minHeight: 80, border: 0, padding: 0, background: 'transparent', fontSize: 15 }} />
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: save.notes ? 'var(--ink)' : 'var(--mute)', fontSize: 14 }}>
            <span style={{ color: 'var(--mute)' }}><Icon name="edit" size={20} stroke={1.7} /></span>
            <span style={{ flex: 1, lineHeight: 1.45 }}>{save.notes || 'Add a note'}</span>
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}><ReminderControl value={save.resurfaceAt} onChange={setReminder} /></div>

      {recs.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <SectionLabel>Because you saved this</SectionLabel>
          {recs.slice(0, 3).map((r) => <ListRow key={r._id} category={r.category} title={r.title} meta={r.extractedLocation?.city} onClick={() => onNavigate('save-detail', { id: r._id })} />)}
        </section>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
        {primary && (primary.href
          ? <a className="wt-btn sm" href={primary.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flex: 1 }}><Icon name={primary.icon} size={17} stroke={2} />{primary.label}</a>
          : <Button small icon={primary.icon} onClick={primary.onClick} style={{ flex: 1 }}>{primary.label}</Button>)}
        <Button small variant="secondary" icon="folder" onClick={() => onNavigate('collections', { addSaveId: id })} style={{ width: 52, flexShrink: 0 }} />
      </div>
    </div>
  );
}
