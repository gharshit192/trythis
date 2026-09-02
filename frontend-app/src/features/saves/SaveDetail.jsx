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

export default function SaveDetail({ onNavigate, onBack, payload }) {
  const id = payload?.id;
  const [save, setSave] = useState(null);
  const [recs, setRecs] = useState([]);
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(false);
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
  const retry = async () => { setMenu(false); const r = await api.retrySave(id).catch(() => null); flash(r?.status === 'success' ? 'Reading it again…' : 'Retry failed'); };
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
  const status = <StatusControl value={save.intentStatus || 'saved'} onChange={setIntent} />;
  const menuSheet = menu && (
    <div className="wt-sheet" onClick={() => setMenu(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <button type="button" className="wt-menu-row" onClick={share}><Icon name="share" size={20} />Share</button>
        {save.url && <a className="wt-menu-row" href={save.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Icon name="link" size={20} />Open the original</a>}
        {(save.processingStatus === 'failed' || save.processingStatus === 'partial') && <button type="button" className="wt-menu-row" onClick={retry}><Icon name="sparkle" size={20} />Read it again</button>}
        <button type="button" className="wt-menu-row danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}><Icon name="close" size={20} />Delete</button>
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
    return <>{menuSheet}{deleteSheet}<Trip save={save} onNavigate={onNavigate} onBack={onBack} onMore={() => setMenu(true)} statusControl={status} /></>;
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
  const processing = ['pending', 'processing', 'failed', 'partial'].includes(save.processingStatus);

  return (
    <div className="wt-screen">
      {menuSheet}{deleteSheet}
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

      <div style={{ marginBottom: save.intentStatus === 'planned' ? 12 : 24 }}>{status}</div>
      {save.intentStatus === 'planned' && (
        <div style={{ marginBottom: 24, padding: '13px 14px', borderRadius: 12, background: 'var(--teal-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--teal)' }}>When?</span>
          {save.plannedFor && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--teal-d)' }}>{new Date(save.plannedFor).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</span>}
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
