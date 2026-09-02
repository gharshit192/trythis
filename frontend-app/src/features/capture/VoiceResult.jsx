import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import SectionLabel from '../../components/SectionLabel';

// The document a voice note became: who / where / about / remind me, the
// transcript underneath with its language, and a preview of the reminder.
const KIND = { person: 'learn', place: 'place', idea: 'learn', task: 'food', note: 'none' };
const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export default function VoiceResult({ onNavigate, onBack, payload }) {
  const save = payload?.save;
  const [busy, setBusy] = useState(false);
  if (!save) return <div className="wt-screen"><div className="wt-note error">Nothing to show.</div></div>;

  const ent = save.entities || {};
  const rows = [
    ['Who', (ent.people || []).join(', ')],
    ['Where', ent.place],
    ['About', ent.topic],
  ].filter(([, v]) => v);
  const remind = fmt(save.resurfaceAt);
  const timeWord = save.aiAnalysis?.timeSignal;
  const transcript = save.aiAnalysis?.transcription?.text;
  const lang = save.aiAnalysis?.transcription?.detectedLanguage;
  const kindLabel = save.memoryType ? save.memoryType[0].toUpperCase() + save.memoryType.slice(1) : 'Note';

  const keep = () => onNavigate('save-detail', { id: save._id, refresh: true });
  const discardAndRedo = async () => { setBusy(true); try { await api.deleteSave(save._id); } catch {} setBusy(false); onNavigate('voice'); };

  return (
    <div className="wt-screen">
      <div className="wt-topbar" style={{ marginBottom: 24 }}>
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
        <span className="wt-link" style={{ fontSize: 13, fontWeight: 500 }} onClick={keep}>Edit</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--cat-${KIND[save.memoryType] || 'none'})` }} />
        <span className="wt-eyebrow" style={{ fontSize: 12, letterSpacing: '.1em', color: `var(--cat-${KIND[save.memoryType] || 'none'})` }}>{kindLabel}</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>· from a voice note{payload?.seconds ? `, 0:${String(payload.seconds).padStart(2, '0')}` : ''}</span>
      </div>
      <h1 className="wt-title" style={{ fontSize: 32, marginBottom: 22 }}>{save.title}</h1>

      <div style={{ borderTop: '1px solid var(--line)', marginBottom: 20 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 88, flexShrink: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', paddingTop: 3 }}>{k}</span>
            <span style={{ fontSize: 15.5 }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <span style={{ width: 88, flexShrink: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Remind me</span>
          {remind
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--teal)' }}>{remind}</span>{timeWord && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>· "{timeWord}"</span>}</span>
            : <span style={{ fontSize: 15.5, color: 'var(--faint)' }}>No date — we'll keep it findable</span>}
        </div>
      </div>

      {transcript && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <SectionLabel>What you said</SectionLabel>
          <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0, color: 'var(--mute)' }}>{transcript}</p>
          <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{lang && lang !== 'en' ? `${lang === 'hi' ? 'Hindi' : lang}, translated · ` : ''}original audio kept</span>
        </div>
      )}

      {remind && <Banner icon="clock">On {remind} we'll bring this back: <em>"{save.aiAnalysis?.summary || save.title}"</em></Banner>}

      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 10 }}>
        <Button small onClick={keep}>Save</Button>
        <Button small variant="secondary" style={{ width: 'auto', padding: '0 18px' }} onClick={discardAndRedo} disabled={busy}>Re-record</Button>
      </div>
    </div>
  );
}
