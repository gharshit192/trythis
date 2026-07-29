import { useState, useEffect, useRef } from 'react';
import api from '../api';

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

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--linen)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="qs-sheet">
          <div className="qs-handle"></div>

          {state === 'saving' && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 48, height: 48, background: 'var(--rust)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', animation: 'si-spin 1s linear infinite',
                }}
              >
                <i className="ti ti-loader" style={{ fontSize: 25, color: '#fff' }}></i>
              </div>
              <div className="qs-st" style={{ marginBottom: 6 }}>Saving…</div>
              <div className="qs-ex">One sec — grabbing what you shared.</div>
            </div>
          )}

          {state === 'saved' && (
            <>
              <div className="qs-sr">
                <div className="qs-check">✓</div>
                <div className="qs-st">Saved to Wanna Try!</div>
              </div>
              <div className="qs-ex" style={{ textAlign: 'center', marginBottom: 16 }}>
                We're analysing it in the background — it'll show up in your Saves shortly.
              </div>
              <div className="qs-btns">
                <button className="qs-bp" onClick={goHome}>Go to Saves</button>
              </div>
            </>
          )}

          {state === 'duplicate' && (
            <>
              <div className="qs-sr">
                <div className="qs-check">✓</div>
                <div className="qs-st">Already saved</div>
              </div>
              <div className="qs-ex" style={{ textAlign: 'center', marginBottom: 16 }}>
                This one's in your Saves already.
              </div>
              <div className="qs-btns">
                <button className="qs-bp" onClick={goHome}>Go to Saves</button>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="qs-sr">
                <div className="qs-st">Couldn't save that</div>
              </div>
              <div className="qs-ex" style={{ textAlign: 'center', marginBottom: 16 }}>{detail}</div>
              <div className="qs-btns">
                <button className="qs-bp" onClick={() => onNavigate('add-save')}>Add manually</button>
                <button className="qs-bs" onClick={goHome}>Go to app</button>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes si-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
