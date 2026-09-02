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
  { key: 'shots',  icon: 'image',     kind: 'shop',  title: 'Upload screenshots', text: 'Menus, chats, lists — we read the text' },
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

function Links({ onBack, onNavigate, collections, onboarding }) {
  const [text, setText] = useState('');
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
      <p className="wt-sub" style={{ marginBottom: 22 }}>As many as you like, one per line. We read each one.</p>
      {error && <div className="wt-note error">{error}</div>}
      <textarea className="wt-input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://www.instagram.com/reel/…\nhttps://youtube.com/shorts/…'} style={{ minHeight: 150, marginBottom: 12 }} />
      <span style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 18 }}>{urls.length ? `${urls.length} link${urls.length === 1 ? '' : 's'} found` : ' '}</span>
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
      <h1 className="wt-title lg" style={{ marginBottom: 9 }}>Upload screenshots</h1>
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
