import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

// Web Share Target landing: Android's share sheet opens the installed PWA at
// /share-target?url=…&text=…&title=… (see public/manifest.json). This screen
// fires the save immediately — the whole point is one-tap capture without
// "using the app" — then shows a small confirmation.
export default function ShareIntake({ onNavigate, payload }) {
  const [state, setState] = useState('saving'); // saving | saved | duplicate | error
  const [detail, setDetail] = useState('');
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return; // strict-mode double-mount guard: save once
    firedRef.current = true;

    const run = async () => {
      const url = (payload?.url || '').trim();
      const title = (payload?.title || '').trim();
      const text = (payload?.text || '').trim();

      if (!url && !text && !title) {
        setState('error');
        setDetail('Nothing shareable was received.');
        return;
      }

      try {
        const res = await api.createSave({
          url: url || undefined,
          // No URL (plain-text share) → keep the text as the note so it isn't lost.
          title: title || (url ? undefined : text.slice(0, 120)),
          notes: !url && text ? text : undefined,
          sourceType: url ? 'url' : 'screenshot',
        });
        if (res.status === 'success') {
          setState('saved');
        } else if (res?.error?.code === 'DUPLICATE_URL') {
          setState('duplicate');
        } else {
          setState('error');
          setDetail(res?.error?.message || 'Could not save. Try again from the app.');
        }
      } catch (err) {
        if (String(err?.message || '').includes('DUPLICATE')) {
          setState('duplicate');
        } else {
          setState('error');
          setDetail('Could not reach the server. Check your connection and try again.');
        }
      }
    };
    run();
  }, [payload]);

  const goHome = () => onNavigate('home');

  const copy = {
    saving:    { title: 'Saving…',        text: 'Reading the link. You can close this — we\'ll finish in the background.' },
    saved:     { title: 'Saved',          text: 'It\'s in your list. We\'ll tell you when it\'s been read.' },
    duplicate: { title: 'Already saved',  text: 'You had this one. Nothing was added twice.' },
    error:     { title: 'Couldn\'t save', text: detail },
  }[state];

  return (
    <div className="wt-screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, background: state === 'error' ? '#F7E5E3' : 'var(--teal-soft)', color: state === 'error' ? '#A6392F' : 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        {state === 'saving' ? <span className="wt-spinner" /> : <Icon name={state === 'error' ? 'close' : 'check'} size={32} stroke={2.2} />}
      </div>
      <h1 className="wt-title" style={{ marginBottom: 8 }}>{copy.title}</h1>
      <p className="wt-sub" style={{ maxWidth: 280, marginBottom: 28 }}>{copy.text}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        <Button small onClick={goHome}>Open Wanna Try</Button>
        {state === 'error' && <Button small variant="secondary" onClick={() => onNavigate('add-save')}>Add it another way</Button>}
      </div>
    </div>
  );
}
