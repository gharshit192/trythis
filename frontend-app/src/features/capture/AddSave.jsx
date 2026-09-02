import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import Chip from '../../components/Chip';

// Capture — the differentiator. Four ways in: paste links (one or many),
// upload screenshots, say it, or share from another app. Links and screenshots
// go to the async pipeline and land on the "reading your reels" screen.
const MODES = [
  { key: 'links',  icon: 'link',      kind: 'learn', title: 'Paste links',        text: 'Reels, Shorts, articles — one per line' },
  { key: 'shots',  icon: 'image',     kind: 'shop',  title: 'Upload bills & screenshots', text: 'Bills, invoices, menus, chats — we read them and remind you' },
  { key: 'voice',  icon: 'mic',       kind: 'place', title: 'Remember this',      text: 'Say it in Hindi, English or mixed' },
  { key: 'share',  icon: 'instagram', kind: 'food',  title: 'Share from Instagram', text: 'Open a reel → Share → Wanna Try' },
];
const urlsIn = (text) => [...new Set((text.match(/https?:\/\/[^\s<>"']+/g) || []).map((u) => u.replace(/[),.]+$/, '')))];

export default function AddSave({ onNavigate, onBack, payload }) {
  const [mode, setMode] = useState(payload?.mode === 'links' ? 'links' : payload?.mode === 'shots' ? 'shots' : null);
  const [collections, setCollections] = useState([]);
  useEffect(() => { api.getCollections().then((r) => r?.status === 'success' && setCollections(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { if (payload?.mode === 'voice') onNavigate('voice'); }, [payload?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'links') return <Links onBack={() => setMode(null)} onNavigate={onNavigate} collections={collections} onboarding={payload?.onboarding} />;
  if (mode === 'shots') return <Shots onBack={() => setMode(null)} onNavigate={onNavigate} collections={collections} />;

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Close" onClick={onBack}><Icon name="close" size={22} /></button>
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 9 }}>What did you<br />find?</h1>
      <p className="wt-sub" style={{ marginBottom: 26 }}>Anything with a link, a picture, or a sentence.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODES.map((m) => (
          <button key={m.key} type="button" onClick={() => m.key === 'voice' ? onNavigate('voice') : m.key === 'share' ? null : setMode(m.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '17px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--card)', cursor: m.key === 'share' ? 'default' : 'pointer', textAlign: 'left' }}>
            <span className={`wt-tile ${m.kind}`}><Icon name={m.icon} size={22} stroke={1.7} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{m.title}</span>
              <span style={{ fontSize: 13.5, color: 'var(--mute)', lineHeight: 1.35 }}>{m.text}</span>
            </span>
            {m.key !== 'share' && <Icon name="forward" size={16} style={{ color: 'var(--faint)' }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function CollectionPick({ collections, value, onChange }) {
  if (!collections.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <span className="wt-label">Add to</span>
      <div className="wt-chips">
        {collections.map((c) => <Chip key={c._id} small on={value === c._id} onClick={() => onChange(value === c._id ? null : c._id)}>{c.name}</Chip>)}
      </div>
    </div>
  );
}

const platformOf = (u) => /instagram\.com/.test(u) ? { label: 'Instagram', icon: 'instagram' }
  : /youtu\.?be/.test(u) ? { label: /shorts\//.test(u) ? 'Short' : 'YouTube', icon: 'play' }
  : /tiktok\.com/.test(u) ? { label: 'TikTok', icon: 'play' }
  : /pinterest\./.test(u) ? { label: 'Pinterest', icon: 'image' }
  : /(zomato|swiggy|dineout|eazydiner)\./.test(u) ? { label: 'Restaurant', icon: 'bowl' }
  : /(amazon|flipkart|myntra|nykaa|ajio|meesho)\./.test(u) ? { label: 'Shop', icon: 'bag' }
  : /maps\.(google|app)|goo\.gl\/maps|g\.co\/kgs/.test(u) ? { label: 'Map', icon: 'pin' }
  : { label: 'Link', icon: 'link' };

function Links({ onBack, onNavigate, collections, onboarding }) {
  const [text, setText] = useState('');
  const [pasted, setPasted] = useState(false);
  // One tap instead of long-press → paste: read the clipboard, keep only the links,
  // dedupe against what's already in the box.
  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      const found = urlsIn(clip);
      if (!found.length) { setError(clip.trim() ? 'No links in your clipboard — copy a reel or an article first.' : 'Your clipboard is empty.'); return; }
      setError(null); setPasted(true);
      setText((t) => [...new Set([...urlsIn(t), ...found])].join('\n'));
    } catch { setError("Couldn't read the clipboard — paste into the box instead."); }
  };
  const [col, setCol] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const urls = urlsIn(text);

  const submit = async () => {
    if (!urls.length) return setError('Paste at least one link.');
    setBusy(true); setError(null);
    try {
      const results = await Promise.all(urls.map((u) => api.submitLink(u).catch(() => null)));
      const jobIds = results.map((r) => r?.jobId).filter(Boolean);
      const saveIds = results.map((r) => r?.saveId).filter(Boolean);
      if (col) await Promise.all(saveIds.map((id) => api.addSaveToCollection(col, id).catch(() => null)));
      if (!jobIds.length) throw new Error('Those links could not be submitted.');
      onNavigate('extracting', { jobIds, links: urls, onboarding });
    } catch (e) { setError(e.message || 'Could not save those links.'); setBusy(false); }
  };

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 9 }}>Paste links</h1>
      <p className="wt-sub" style={{ marginBottom: 18 }}>Copy a reel, a Short, an article — or a whole chat full of them. We pick out every link.</p>
      {error && <div className="wt-note error">{error}</div>}
      {navigator.clipboard?.readText && (
        <button type="button" onClick={pasteFromClipboard}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 12, padding: '13px 14px', borderRadius: 12, background: 'var(--teal-soft)', border: 0, color: 'var(--teal-d)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <Icon name="link" size={18} />
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{pasted ? 'Paste again from clipboard' : 'Paste from clipboard'}</span>
          <Icon name="forward" size={16} />
        </button>
      )}
      <textarea className="wt-input" autoFocus={!navigator.clipboard?.readText} value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://www.instagram.com/reel/…\nhttps://youtube.com/shorts/…'} style={{ minHeight: 120, marginBottom: 12 }} />
      {urls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {urls.slice(0, 8).map((u) => { const p = platformOf(u); return (
            <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--teal)' }}><Icon name={p.icon} size={17} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}>{p.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <button type="button" aria-label="Remove" onClick={() => setText((t) => t.split(/\s+/).filter((x) => x !== u).join('\n'))} style={{ background: 'none', border: 0, color: 'var(--faint)', cursor: 'pointer', padding: 0, display: 'flex' }}><Icon name="close" size={16} /></button>
            </div>); })}
          {urls.length > 8 && <span style={{ fontSize: 13, color: 'var(--faint)' }}>and {urls.length - 8} more</span>}
        </div>
      )}
      <CollectionPick collections={collections} value={col} onChange={setCol} />
      <div style={{ marginTop: 'auto' }}>
        <Button onClick={submit} disabled={busy || !urls.length}>{busy ? 'Sending…' : urls.length > 1 ? `Read ${urls.length} links` : 'Read it'}</Button>
      </div>
    </div>
  );
}

function Shots({ onBack, onNavigate, collections }) {
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [col, setCol] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  const pick = (list) => setFiles((f) => [...f, ...Array.from(list || [])].slice(0, 10));
  const submit = async () => {
    if (!files.length) return setError('Pick at least one screenshot.');
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      if (title.trim()) fd.append('title', title.trim());
      if (col) fd.append('collectionId', col);
      const result = await api.analyzeScreenshotBundle(fd);
      if (result?.status !== 'success') throw new Error(result?.error?.message || 'Could not read those.');
      const saved = await api.saveScreenshotBundle(result.sessionId, result.summary);
      const doc = saved?.save || saved?.data || null;
      onNavigate('screenshot-summary', { sessionId: result.sessionId, summary: result.summary, saveId: doc?._id || null, autoSaved: !!doc?._id });
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
      </div>
      <h1 className="wt-title lg" style={{ marginBottom: 9 }}>Bills, invoices,<br />screenshots</h1>
      <p className="wt-sub" style={{ marginBottom: 22 }}>Up to ten. A menu, a chat, a list — we read every line.</p>
      {error && <div className="wt-note error">{error}</div>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      <button type="button" onClick={() => input.current?.click()}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '17px 16px', border: '1.5px dashed var(--line)', borderRadius: 14, background: 'var(--card)', cursor: 'pointer', textAlign: 'left', marginBottom: 18 }}>
        <span className="wt-tile shop"><Icon name="image" size={22} stroke={1.7} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{files.length ? `${files.length} selected` : 'Choose screenshots'}</span>
          <span style={{ fontSize: 13.5, color: 'var(--mute)' }}>{files.length ? 'Tap to add more' : 'PNG, JPG or WebP'}</span>
        </span>
      </button>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button type="button" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))} aria-label="Remove" style={{ background: 'none', border: 0, color: 'var(--faint)', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="wt-field"><label className="wt-label" htmlFor="shotsTitle">Title (optional)</label>
        <input id="shotsTitle" className="wt-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this?" /></div>
      <CollectionPick collections={collections} value={col} onChange={setCol} />
      <div style={{ marginTop: 'auto' }}>
        <Button onClick={submit} disabled={busy || !files.length}>{busy ? 'Reading…' : 'Read them'}</Button>
      </div>
    </div>
  );
}
