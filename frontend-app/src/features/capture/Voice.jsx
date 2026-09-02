import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';

// "Remember this" — speak in Hindi, English or mixed. Audio goes to the same
// speech stack reel audio uses; Claude turns the transcript into a document
// (ADR 0016).
const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

// MediaRecorder gives webm/opus (or mp4). The speech API needs real PCM WAV —
// sending opus bytes labelled "wav" decodes as noise. Decode, resample to
// 16 kHz mono, and write a WAV header ourselves; no server-side ffmpeg needed.
const toWav16k = async (blob) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const rate = 16000;
  const length = Math.ceil(decoded.duration * rate);
  const off = new OfflineAudioContext(1, length, rate);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start(0);
  const mono = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + mono.length * 2));
  const str = (o, t) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + mono.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, mono.length * 2, true);
  for (let i = 0; i < mono.length; i++) { const v = Math.max(-1, Math.min(1, mono[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  try { ctx.close(); } catch {}
  return { wav: new Blob([out], { type: 'audio/wav' }), seconds: Math.round(decoded.duration) };
};

export default function Voice({ onNavigate, onBack }) {
  const [state, setState] = useState('idle');   // idle | recording | uploading | error
  const [seconds, setSeconds] = useState(0);
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
  };
  const stop = () => { setState('uploading'); try { rec.current?.stop(); } catch {} stopAll(); };

  const upload = async () => {
    const blob = new Blob(chunks.current, { type: rec.current?.mimeType || 'audio/webm' });
    if (blob.size < 1000) { setError('That was too short. Try again.'); setState('error'); return; }
    try {
      const { wav, seconds: dur } = await toWav16k(blob);
      const res = await api.createVoiceSave(wav, dur || seconds);
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
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 8 }}>{state === 'uploading' ? 'Reading' : state === 'recording' ? 'Recording' : 'Ready'}</span>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.4, margin: 0, color: '#fff' }}>
          {state === 'uploading' ? 'Turning that into a note…' : state === 'recording' ? 'Listening. Take your time.' : 'e.g. "Goa airport pe Rahul mila, EV startup bana raha hai, six months mein follow up karna hai"'}
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
