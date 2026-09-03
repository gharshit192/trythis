import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import StatusControl from '../../components/StatusControl';
import SectionLabel from '../../components/SectionLabel';
import ReminderControl from '../../components/ReminderControl';
import { relativeTime } from '../../lib/format';
import { isTryable } from '../../lib/intent';

// Screenshot saves: what the analyzer read out of the images, in the same
// vocabulary as every other item. The images themselves stay off the screen
// (ADR 0013) — the count and "photos saved" say they exist.
const TYPE_LABEL = {
  receipt: 'Receipt', menu: 'Menu', product_page: 'Product', social_post: 'Post', chat: 'Chat', article: 'Article', map: 'Place',
  notification: 'Notification', code: 'Code', price_list: 'Price list', finance: 'Finance', travel_booking: 'Booking', meme: 'Meme',
  app_ui: 'App screen', handwritten_note: 'Handwritten note', photo: 'Photo', other: 'Screenshots',
};
const TYPE_KIND = { receipt: 'shop', menu: 'food', product_page: 'shop', map: 'place', travel_booking: 'place', finance: 'learn', article: 'learn', code: 'learn', handwritten_note: 'learn', price_list: 'shop' };
const KEY_LABEL = { orderId: 'Order', bookingId: 'Booking', paymentMethod: 'Paid with', restaurantName: 'Restaurant', priceRange: 'Price range', originalPrice: 'Was', placeType: 'Type', keyInfo: 'Key info', keyItems: 'Items', keyElements: 'Key parts', screensVisible: 'Screens', designPatterns: 'Patterns', specialItems: 'Specials', errorMessage: 'Error', rawText: 'Text read', priceVisible: 'Price seen' };
const label = (k) => KEY_LABEL[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const isReminderWorthy = (type) => ['receipt', 'travel_booking', 'price_list', 'finance', 'notification'].includes(type);

function Facts({ obj }) {
  const scalars = Object.entries(obj || {}).filter(([k, v]) => v != null && v !== '' && typeof v !== 'object' && k !== 'rawText' && k !== 'currency');
  if (!scalars.length) return null;
  const cur = obj.currency && obj.currency !== 'INR' ? `${obj.currency} ` : '₹';
  return (
    <div style={{ borderTop: '1px solid var(--line)', marginBottom: 16 }}>
      {scalars.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ width: 96, flexShrink: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', paddingTop: 3 }}>{label(k)}</span>
          <span style={{ fontSize: 15, lineHeight: 1.45 }}>{/^(total|price|originalPrice|discount)$/.test(k) && typeof v === 'number' ? `${cur}${v.toLocaleString('en-IN')}` : String(v)}</span>
        </div>
      ))}
    </div>
  );
}
function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <section style={{ marginBottom: 18 }}>
      <SectionLabel>{title}</SectionLabel>
      {items.map((it, i) => {
        const text = typeof it === 'string' ? it : [it.name || it.title || it.item || it.label, it.price != null ? `₹${it.price}` : null, it.quantity ? `× ${it.quantity}` : null, it.description || it.notes].filter(Boolean).join(' · ');
        const sub = typeof it === 'object' && Array.isArray(it.features) ? it.features.join(' · ') : null;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--faint)', flexShrink: 0 }}>•</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>{text}</span>{sub && <span className="wt-row-meta">{sub}</span>}</span>
          </div>
        );
      })}
    </section>
  );
}

export default function ScreenshotDetail({ save: initial, onNavigate, onBack }) {
  const [save, setSave] = useState(initial);
  useEffect(() => { setSave(initial); }, [initial]);
  const reading = ['pending', 'processing'].includes(save.processingStatus);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!reading) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [reading]);
  const secs = Math.max(0, Math.round((now - new Date(save.createdAt).getTime()) / 1000));
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const flash = (t) => { setToast(t); setTimeout(() => setToast(null), 1800); };
  const id = save._id;

  const sa = save.aiAnalysis?.screenshotAnalysis || {};
  const type = sa.type || sa.data?.type || 'other';
  const data = sa.data || sa.extracted || sa;
  const agg = save.aiAnalysis?.aggregateAnalysis;
  const count = save.screenshots?.length || save.aiAnalysis?.screenshotAnalysis?.data?.totalScreenshots || save.metadata?.screenshotCount || 1;
  const summary = save.aiAnalysis?.summary || save.description || '';
  // The pipeline puts the summary and an OCR quality note into keyPoints; show each once, in its place.
  const diag = /(\d+) of (\d+) lines|transcribed by a single model|need review/i;
  const points = (save.aiAnalysis?.keyPoints || []).filter((k) => k && k !== summary && !diag.test(k));
  const quality = (save.aiAnalysis?.keyPoints || []).find((k) => diag.test(k)) || null;
  // Bundle shape: categories → either a transcribed document (lines) or a list of things.
  const isBundle = sa.type === 'bundle';
  const bundleCats = isBundle ? (data.categories || []) : [];
  const isDoc = (cat) => Array.isArray(cat?.items) && cat.items.length > 0 && cat.items.every((i) => /^Line \d+/.test(String(i?.details || '')));
  const docText = (cat) => (cat.items || []).map((i) => String(i?.name || '').trim()).filter(Boolean).reduce((t, line, idx) => (idx === 0 ? line : /-$/.test(t) ? t.slice(0, -1) + line : t + '\n' + line), '');
  const hw = data.handwrittenAnalysis || null;
  const ents = hw?.entities || {};
  const topicPoints = [...(ents.topics || []), ...(ents.bookTitles || [])].filter(Boolean).slice(0, 20);
  const entityRows = [['People', ents.people], ['Places', ents.locations], ['Organisations', ents.organizations], ['Dates', ents.dates], ['Amounts', ents.currencies?.length ? ents.currencies : ents.amounts], ['Phone', ents.phoneNumbers], ['Email', ents.emails], ['Websites', ents.websites]].filter(([, v]) => Array.isArray(v) && v.length);
  const lists = isBundle ? [] : Object.entries(data || {}).filter(([k, v]) => Array.isArray(v) && v.length && k !== 'keyPoints');
  const tryable = isTryable(save);

  const setIntent = async (next) => {
    if (next === 'tried') return onNavigate('tried', { id, title: save.title, createdAt: save.createdAt });
    const prev = save.intentStatus; setSave({ ...save, intentStatus: next });
    const r = await api.updateIntent(id, { intentStatus: next }).catch(() => null);
    if (r?.status !== 'success') setSave((s) => ({ ...s, intentStatus: prev }));
  };
  const setReminder = async (date) => { const r = await api.patchSave(id, { resurfaceAt: date }).catch(() => null); if (r?.status === 'success') { setSave(r.data); flash(date ? 'Reminder set' : 'Reminder off'); } };
  const reread = async () => {
    setBusy(true); flash('Reading the photos again… 20–60 s');
    const r = await api.rereadScreenshots(id).catch(() => null);
    setBusy(false);
    if (r?.status === 'success') { setSave(r.data); flash('Updated'); } else flash(r?.error?.message || 'Could not read it again');
  };
  const pdf = async () => { setBusy(true); try { const how = await api.exportScreenshotPdf(id, save.title); if (how === 'downloaded') flash('PDF downloaded'); } catch (e) { flash(e.message || 'PDF failed'); } finally { setBusy(false); } };
  const share = async () => {
    setMenu(false); setBusy(true);
    try { const r = await api.shareSave(id); const url = r?.data?.shareUrl || r?.shareUrl; if (url && navigator.share) await navigator.share({ title: save.title, url }); else if (url) { await navigator.clipboard?.writeText(url); flash('Link copied'); } }
    catch {} finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); const r = await api.deleteSave(id).catch(() => null); setBusy(false); if (r?.status === 'success') onNavigate('home', { refresh: true }); else flash('Delete failed'); };

  return (
    <div className="wt-screen">
      {menu && (
        <div className="wt-sheet" onClick={() => setMenu(false)}><div onClick={(e) => e.stopPropagation()}><div className="grab" />
          <button type="button" className="wt-menu-row" onClick={share}><Icon name="share" size={20} />Share</button>
          <button type="button" className="wt-menu-row" onClick={() => { setMenu(false); reread(); }}><Icon name="sparkle" size={20} />Read it again</button>
          <button type="button" className="wt-menu-row" onClick={() => { setMenu(false); pdf(); }}><Icon name="book" size={20} />Download as PDF</button>
          <button type="button" className="wt-menu-row danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}><Icon name="close" size={20} />Delete</button>
        </div></div>
      )}
      {confirmDelete && (
        <div className="wt-sheet" onClick={() => setConfirmDelete(false)}><div onClick={(e) => e.stopPropagation()}><div className="grab" />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px' }}>Delete this save?</p>
          <p className="wt-sub" style={{ marginBottom: 18 }}>The screenshots and everything read from them go too.</p>
          <div style={{ display: 'flex', gap: 10 }}><Button small variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button small onClick={remove} disabled={busy} style={{ background: '#A6392F' }}>Delete</Button></div>
        </div></div>
      )}
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '9px 14px', borderRadius: 10, fontSize: 13.5, zIndex: 70 }}>{toast}</div>}

      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack || (() => onNavigate('home'))}><Icon name="back" size={22} /></button>
        <div className="acts">
          <button type="button" className="wt-iconbtn" aria-label="Share" onClick={share}><Icon name="share" size={21} /></button>
          <button type="button" className="wt-iconbtn" aria-label="More" onClick={() => setMenu(true)}><Icon name="more" size={21} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--cat-${TYPE_KIND[type] || 'none'})` }} />
        <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em', color: `var(--cat-${TYPE_KIND[type] || 'none'})` }}>{TYPE_LABEL[type] || 'Screenshots'}</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>· {count} photo{count === 1 ? '' : 's'} saved</span>
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 10 }}>{save.title || 'Untitled'}</h1>
      <span style={{ fontSize: 14.5, color: 'var(--mute)', marginBottom: 22 }}>Saved {relativeTime(save.createdAt).toLowerCase()}{data.date ? ` · dated ${data.date}` : ''}</span>

      {reading && (
        <div style={{ marginBottom: 22, padding: '14px', borderRadius: 14, background: 'var(--teal-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="wt-spinner" />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: 'var(--teal-d)' }}>{secs < 25 ? 'Reading the text — Hindi and English…' : secs < 70 ? 'Working out what it says…' : 'Almost there — a long document takes a minute or two…'}</span>
            <span style={{ fontSize: 12.5, color: 'var(--teal)', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(secs / 60) ? `${Math.floor(secs / 60)}m ` : ''}{secs % 60}s</span>
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--teal-d)' }}>You can leave — it's saved, and your phone will tell you when it's ready.</span>
        </div>
      )}
      {!reading && (tryable
        ? <div style={{ marginBottom: 24 }}><StatusControl value={save.intentStatus || 'saved'} onChange={setIntent} /></div>
        : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '10px 12px', borderRadius: 12, background: 'var(--card-2)', fontSize: 13.5, color: 'var(--mute)' }}>
            <Icon name="book" size={16} /><span style={{ flex: 1 }}>A document, not a place to try — keep it, set a reminder, or mark it done.</span>
            <button type="button" onClick={() => setIntent(save.intentStatus === 'dismissed' ? 'saved' : 'dismissed')} style={{ background: 'none', border: 0, color: 'var(--teal)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{save.intentStatus === 'dismissed' ? 'Keep' : 'Done'}</button>
          </div>
        ))}

      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          <SectionLabel>What it says</SectionLabel>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>{summary}</p>
        </div>
      )}
      {(points.length ? points : topicPoints).length > 0 && <List title={points.length ? 'Key points' : 'What it covers'} items={points.length ? points : topicPoints} />}
      {entityRows.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', marginBottom: 16 }}>
          {entityRows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 96, flexShrink: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', paddingTop: 3 }}>{k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>{v.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
      {bundleCats.map((cat, ci) => isDoc(cat) ? (
        <section key={ci} style={{ marginBottom: 20 }}>
          <SectionLabel>{hw?.language ? `Text read · ${hw.language}` : 'Text read'}</SectionLabel>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{docText(cat)}</p>
          {quality && <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '8px 0 0' }}>{quality.replace(/;.*$/, '')} — check against the photo.</p>}
        </section>
      ) : (
        <List key={ci} title={`${cat.name || 'Items'}${cat.count ? ` · ${cat.count}` : ''}`} items={(cat.items || []).map((i) => ({ name: i.name, description: [i.details, ...(i.tags || [])].filter(Boolean).join(' · ') }))} />
      ))}
      {!isBundle && <Facts obj={data} />}
      {lists.map(([k, v]) => <List key={k} title={label(k)} items={v} />)}
      {data.rawText && <div style={{ marginBottom: 18 }}><SectionLabel>Text read</SectionLabel><p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--mute)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{data.rawText}</p></div>}

      {agg && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Across all {count} photos</SectionLabel>
          {(agg.summary || agg.combinedSummary) && <p style={{ fontSize: 15, lineHeight: 1.55, margin: '6px 0 12px' }}>{agg.summary || agg.combinedSummary}</p>}
          <List title="Highlights" items={agg.highlights} />
          {(agg.themes || []).map((t, i) => <div key={i} style={{ marginBottom: 10 }}><span style={{ fontWeight: 600, fontSize: 15 }}>{t.title || t.name || `Theme ${i + 1}`}</span>{(t.description || t.summary) && <p className="wt-row-meta" style={{ margin: '2px 0 0' }}>{t.description || t.summary}</p>}</div>)}
          <List title="To do" items={agg.actions || agg.actionItems} />
        </section>
      )}

      {isReminderWorthy(type) && <div style={{ marginBottom: 10, padding: '11px 14px', borderRadius: 12, background: '#F1EDE5', fontSize: 13.5, color: '#6B5747', lineHeight: 1.45 }}>A {TYPE_LABEL[type].toLowerCase()} usually has a date attached — warranty, return window, due date. Set a reminder below.</div>}
      <ReminderControl value={save.resurfaceAt} onChange={setReminder} />

      <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
        <Button small icon="book" onClick={pdf} disabled={busy} style={{ flex: 1 }}>{busy ? 'Preparing…' : 'Download PDF'}</Button>
        <Button small variant="secondary" icon="folder" onClick={() => onNavigate('collections', { addSaveId: id })} style={{ width: 52, flexShrink: 0 }} />
      </div>
    </div>
  );
}
