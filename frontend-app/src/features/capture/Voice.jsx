import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';

// "Remember this" — speak in Hindi, English or mixed. Audio goes to the same
// speech stack reel audio uses; Claude turns the transcript into a document
// (ADR 0016). The live text is a browser hint only; the server's transcript wins.
const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

export default function Voice({ onNavigate, onBack }) {
  const [state, setState] = useState('idle');   // idle | recording | uploading | error
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState(null);
  const rec = useRef(null); const chunks = useRef([]); const stream = useRef(null); const speech = useRef(null);

  const stopAll = () => {
    try { speech.current?.stop(); } catch {}
    try { stream.current?.getTracks().forEach((t) => t.stop()); } catch {}
  };
  useEffect(() => () => stopAll(), []);
  useEffect(() => { if (state !== 'recording') return; const h = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(h); }, [state]);

  const start = async () => {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { setError('Microphone access is needed to record.'); setState('error'); return; }
    chunks.current = [];
    const r = new MediaRecorder(stream.current, pickMime() ? { mimeType: pickMime() } : undefined);
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = upload;
    rec.current = r; r.start(250);
    setSeconds(0); setState('recording');
    // Optional on-device hint while speaking; never sent to the server.
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { try { const s = new SR(); s.lang = 'hi-IN'; s.continuous = true; s.interimResults = true; s.onresult = (e) => setHint([...e.results].map((x) => x[0].transcript).join(' ')); s.start(); speech.current = s; } catch {} }
  };
  const stop = () => { setState('uploading'); try { rec.current?.stop(); } catch {} stopAll(); };

  const upload = async () => {
    const blob = new Blob(chunks.current, { type: rec.current?.mimeType || 'audio/webm' });
    if (blob.size < 1000) { setError('That was too short. Try again.'); setState('error'); return; }
    try {
      const res = await api.createVoiceSave(blob, seconds);
      if (res?.status === 'success') onNavigate('voice-result', { save: res.data, seconds });
      else { setError(res?.error?.message || 'Could not read that. Try again.'); setState('error'); }
    } catch (e) { setError(e.message || 'Upload failed'); setState('error'); }
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="wt-screen dark">
      <div className="wt-topbar" style={{ marginBottom: 40 }}>
        <button type="button" className="wt-iconbtn" aria-label="Close" style={{ color: 'rgba(255,255,255,.75)' }} onClick={() => { stopAll(); onBack(); }}><Icon name="close" size={22} /></button>
        {state === 'recording' && <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, letterSpacing: '.06em', color: 'rgba(255,255,255,.85)' }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#E06A4F' }} />{mmss}</span>}
      </div>

      <span className="wt-eyebrow" style={{ color: 'var(--sand)', marginBottom: 10 }}>Remember this</span>
      <h1 className="wt-title" style={{ color: '#fff', marginBottom: 30 }}>Just say it. Hindi,<br />English, mixed — fine.</h1>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 64, marginBottom: 30 }} aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ width: 4, borderRadius: 2, background: 'var(--sand)', height: 44, transformOrigin: 'center', transform: `scaleY(${state === 'recording' ? 0.35 + ((i * 7) % 10) / 14 : 0.25})`, transition: 'transform .3s', animation: state === 'recording' ? `wt-bob 1.1s ease-in-out ${(i * 0.06) % 1}s infinite` : 'none' }} />
        ))}
      </div>

      <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', minHeight: 96 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 8 }}>{state === 'uploading' ? 'Reading' : state === 'recording' ? 'Hearing' : 'Ready'}</span>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.4, margin: 0, color: '#fff' }}>
          {state === 'uploading' ? 'Turning that into a note…' : hint || (state === 'recording' ? '…' : 'e.g. "Goa airport pe Rahul mila, EV startup bana raha hai, six months mein follow up karna hai"')}
        </p>
      </div>
      {error && <div className="wt-note error" style={{ marginTop: 14 }}>{error}</div>}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <button type="button" aria-label={state === 'recording' ? 'Stop' : 'Record'} disabled={state === 'uploading'}
          onClick={state === 'recording' ? stop : start}
          style={{ width: 78, height: 78, borderRadius: 39, background: '#fff', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 28px rgba(0,0,0,.3)', cursor: 'pointer' }}>
          {state === 'recording' ? <span style={{ width: 26, height: 26, borderRadius: 6, background: '#E06A4F' }} /> : state === 'uploading' ? <span className="wt-spinner" /> : <span style={{ color: 'var(--teal-d)' }}><Icon name="mic" size={30} stroke={2} /></span>}
        </button>
        <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)' }}>{state === 'recording' ? 'Tap to stop. We\'ll sort out the rest.' : 'Tap to start'}</span>
      </div>
      <style>{'@keyframes wt-bob{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@media(prefers-reduced-motion:reduce){[style*="wt-bob"]{animation:none!important}}'}</style>
    </div>
  );
}
