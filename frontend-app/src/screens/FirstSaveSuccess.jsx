import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { getCategoryMeta } from '../categoryMeta';

// Steps advance once and HOLD on the last one — no infinite loop, so it never
// looks "stuck". Video extraction can take 1–2 min, so we never block on it.
const STEPS = ['Reading your save…', 'Figuring out what it is…', 'Organising it for you…', 'Almost ready…'];
const MAX_POLLS = 6; // ~9s, then we let the user go and finish in the background

export default function FirstSaveSuccess({ onNavigate, payload }) {
  const [step, setStep] = useState(0);
  const [save, setSave] = useState(null);
  const [ready, setReady] = useState(false);
  const [bgProcessing, setBgProcessing] = useState(false);
  const pollsRef = useRef(0);

  // Advance the step text, holding on the final one (no confusing loop).
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);
    return () => clearTimeout(timer);
  }, [step, ready]);

  // Resolve the save: a synchronous saveId, or poll the job until it attaches
  // a result — but only briefly; long extractions finish in the background.
  useEffect(() => {
    let cancelled = false;

    const loadSave = async (id) => {
      try {
        const res = await api.getSaveById(id);
        if (!cancelled && res.status === 'success') {
          setSave(res.data);
          setBgProcessing(res.data?.processingStatus === 'processing');
          setReady(true);
        }
      } catch {}
    };

    if (payload?.saveId) {
      loadSave(payload.saveId);
      return () => { cancelled = true; };
    }

    if (!payload?.jobId) {
      const t = setTimeout(() => { if (!cancelled) setReady(true); }, 1500);
      return () => { cancelled = true; clearTimeout(t); };
    }

    const poll = async () => {
      try {
        const job = await api.getJobStatus(payload.jobId);
        if (cancelled) return;
        if (job?.result?.saveId) { await loadSave(job.result.saveId); return; }
        if (String(job?.status).toLowerCase() === 'failed') { setBgProcessing(false); setReady(true); return; }
        pollsRef.current += 1;
        if (pollsRef.current >= MAX_POLLS) {
          // Still crunching — show a clear "processing in background" card and
          // let the user move on. They'll get an "Upload ready" notification.
          setBgProcessing(true);
          setReady(true);
          return;
        }
        setTimeout(poll, 1500);
      } catch {
        if (!cancelled) { setBgProcessing(true); setReady(true); }
      }
    };
    poll();

    // Hard safety net: never let the screen hang. If nothing has resolved in
    // 12s (slow/saturated backend, hung fetch, …), show the background card.
    const hardStop = setTimeout(() => { if (!cancelled) setReady(true); }, 12000);

    return () => { cancelled = true; clearTimeout(hardStop); };
  }, [payload?.saveId, payload?.jobId]);

  const goDone = () => onNavigate(payload?.nextScreen || 'home');
  const goView = () => { if (save?._id) onNavigate('save-detail', { id: save._id }); else goDone(); };

  const meta = getCategoryMeta(save?.category);
  // Background-processing = the job hasn't produced a finished save yet.
  const processing = bgProcessing || !save || save?.processingStatus === 'processing';

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--linen)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="qs-sheet">
          <div className="qs-handle"></div>

          {!ready ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 48, height: 48, background: 'var(--rust)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', animation: 'qs-spin 1s linear infinite',
                }}
              >
                <i className="ti ti-loader" style={{ fontSize: 25, color: '#fff' }}></i>
              </div>
              <div className="qs-st" style={{ marginBottom: 6 }}>{STEPS[step]}</div>
              <div className="qs-ex">Hang tight…</div>
            </div>
          ) : (
            <>
              <div className="qs-sr">
                <div className="qs-check">✓</div>
                <div className="qs-st">Saved to Wanna Try!</div>
              </div>

              <div className="qs-card">
                {save?.thumbnail ? (
                  <div className="qs-th" style={{ backgroundImage: `url(${save.thumbnail})` }} />
                ) : (
                  <div className={`qs-th ${meta.gradientClass}`}>
                    <i className={`ti ${meta.icon}`}></i>
                  </div>
                )}
                <div className="qs-info">
                  <div className="qs-pn">{save?.title || 'Your save'}</div>
                  <div style={{ marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!processing && (
                      <span className={`chip ${meta.chipClass}`} style={{ fontSize: 10 }}>{meta.emoji} {meta.label}</span>
                    )}
                    {processing && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', border: '1.5px dashed var(--teal)', borderRadius: 3, padding: '2px 7px' }}>
                        <i className="ti ti-loader" style={{ animation: 'qs-spin 1.4s linear infinite' }} /> Processing in background
                      </span>
                    )}
                  </div>
                  <div className="qs-ex">
                    {processing
                      ? "We're analysing this in the background — it'll appear in your Saves shortly, and we'll notify you when it's ready."
                      : (save?.aiAnalysis?.summary || save?.description || 'Saved for later.')}
                  </div>
                </div>
              </div>

              <div className="qs-btns">
                {save?._id
                  ? <button className="qs-bp" onClick={goView}>View Save</button>
                  : <button className="qs-bp" onClick={goDone}>Go to Saves</button>}
                <button className="qs-bs" onClick={goDone}>Done</button>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes qs-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
