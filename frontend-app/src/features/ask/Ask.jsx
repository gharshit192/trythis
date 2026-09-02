import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import ListRow from '../../components/ListRow';
import Chip from '../../components/Chip';
import { getCategoryTile } from '../../lib/categoryMeta';

// Ask Wanna Try (ADR 0017): a chat over what you saved. Every answer is
// grounded in your saves and names the ones it used, so you can tap straight
// into them. Reopening picks up the last thread; + starts a fresh one.
const starters = (city) => [
  city ? `Somewhere for a lazy Sunday in ${city}?` : 'Somewhere for a lazy Sunday?',
  'What recipes did I save that take under 30 minutes?',
  'What did I plan for my next trip?',
  'What have I saved but never tried?',
];

function Answer({ text }) {
  const lines = String(text || '').split('\n').filter((l) => l.trim());
  return (
    <div style={{ fontSize: 15.5, lineHeight: 1.55 }}>
      {lines.map((l, i) => {
        const bullet = /^[-•]\s+/.test(l);
        const t = l.replace(/^[-•]\s+/, '').replace(/\s*\[#\d+\]/g, '').replace(/\*\*/g, '');
        return bullet
          ? <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0' }}><span style={{ color: 'var(--teal)', fontWeight: 600 }}>•</span><span>{t}</span></div>
          : <p key={i} style={{ margin: '0 0 8px' }}>{t}</p>;
      })}
    </div>
  );
}

export default function Ask({ onNavigate, onBack, payload }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef(null);
  const sent = useRef(false);
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  const city = user?.location?.city || user?.settings?.location?.city;

  const send = async (q) => {
    const question = String(q || '').trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: question }]);
    try {
      const r = await api.ask(question, conversationId);
      if (r?.status === 'success') {
        setConversationId(r.data.conversationId);
        setMessages((m) => [...m, { role: 'assistant', content: r.data.answer, refs: r.data.references, followUps: r.data.followUps }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: r?.error?.message || "Couldn't answer that just now. Try again in a moment." }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: "Couldn't reach Wanna Try. Check your connection and try again." }]);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (payload?.question) { setReady(true); send(payload.question); return; }
    api.askLatest().then((r) => {
      const c = r?.data;
      // A thread from the last day is worth continuing; older ones start fresh.
      if (c && Date.now() - new Date(c.updatedAt).getTime() < 24 * 3600 * 1000) { setConversationId(c._id); setMessages(c.messages || []); }
    }).catch(() => {}).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  const fresh = () => { setConversationId(null); setMessages([]); setInput(''); };

  return (
    <div className="wt-screen" style={{ paddingBottom: 96, paddingTop: 0 }}>
      <div className="wt-topbar" style={{ position: 'sticky', top: 'calc(-1 * var(--pad-top))', zIndex: 5, background: 'var(--bg)', margin: '0 calc(-1 * var(--pad-screen)) 16px', padding: 'var(--pad-top) var(--pad-screen) 10px', borderBottom: '1px solid var(--line)' }}>
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, flex: 1, textAlign: 'center' }}>Ask Wanna Try</span>
        <button type="button" className="wt-iconbtn" aria-label="New chat" onClick={fresh} style={{ visibility: messages.length ? 'visible' : 'hidden' }}><Icon name="plus" size={22} /></button>
      </div>

      {ready && messages.length === 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icon name="sparkle" size={22} /></div>
          <h1 className="wt-title" style={{ marginBottom: 8 }}>Ask anything<br />about what you saved.</h1>
          <p style={{ fontSize: 14.5, color: 'var(--mute)', lineHeight: 1.5, margin: '0 0 20px' }}>It only answers from your own saves — places, recipes, trips, notes — and shows you which ones it used.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {starters(city).map((s) => (
              <button key={s} type="button" onClick={() => send(s)} style={{ textAlign: 'left', fontSize: 14.5, padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        {messages.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', background: 'var(--teal-d)', color: '#fff', fontSize: 15, lineHeight: 1.45 }}>{m.content}</div>
          : (
            <div key={i} style={{ alignSelf: 'stretch' }}>
              <Answer text={m.content} />
              {m.refs?.length > 0 && (
                <div style={{ marginTop: 6, borderTop: '1px solid var(--line)' }}>
                  {m.refs.map((r) => (
                    <ListRow key={String(r.saveId)} category={r.category} title={r.title} meta={[getCategoryTile(r.category).label, r.city].filter(Boolean).join(' · ')} onClick={() => onNavigate('save-detail', { id: r.saveId })} />
                  ))}
                </div>
              )}
              {m.followUps?.length > 0 && i === messages.length - 1 && (
                <div className="wt-chips" style={{ marginTop: 10 }}>
                  {m.followUps.map((f) => <Chip key={f} small onClick={() => send(f)}>{f}</Chip>)}
                </div>
              )}
            </div>
          ))}
        {busy && <div style={{ fontSize: 14, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="sparkle" size={16} /> Looking through your saves…</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about anything you saved" autoFocus={!!ready && messages.length === 0 && !payload?.question}
          style={{ flex: 1, height: 46, borderRadius: 23, border: '1px solid var(--line)', background: 'var(--card)', padding: '0 16px', fontSize: 15, color: 'var(--ink)', outline: 'none' }} />
        <button type="submit" aria-label="Send" disabled={!input.trim() || busy}
          style={{ width: 46, height: 46, borderRadius: 23, border: 0, background: input.trim() && !busy ? 'var(--teal)' : 'var(--card-2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="forward" size={20} stroke={2.2} />
        </button>
      </form>
    </div>
  );
}
