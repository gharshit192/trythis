import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { getCategoryMeta } from '../categoryMeta';

export default function FirstSaveSuccess({ onNavigate, payload }) {
  const [step, setStep] = useState(0);
  const [save, setSave] = useState(null);
  const [ready, setReady] = useState(false);
  const pollsRef = useRef(0);
  const steps = ['Reading your save…', 'Figuring out what it is…', 'Organising it for you…'];

  // Step animation while we wait for save data
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % steps.length), 1200);
    return () => clearTimeout(timer);
  }, [step, ready, steps.length]);

  // Resolve the save behind this confirmation: either we already have a saveId
  // (synchronous create), or we have a jobId and need to poll until the
  // background processor attaches a result save.
  useEffect(() => {
    let cancelled = false;

    const loadSave = async (id) => {
      try {
        const res = await api.getSaveById(id);
        if (!cancelled && res.status === 'success') {
          setSave(res.data);
          setReady(true);
        }
      } catch {}
    };

    if (payload?.saveId) {
      loadSave(payload.saveId);
      return () => { cancelled = true; };
    }

    if (!payload?.jobId) {
      // Nothing to resolve — just show a generic confirmation.
      const timer = setTimeout(() => { if (!cancelled) setReady(true); }, 1800);
      return () => { cancelled = true; clearTimeout(timer); };
    }

    const poll = async () => {
      try {
        const job = await api.getJobStatus(payload.jobId);
        if (cancelled) return;
        if (job?.result?.saveId) {
          await loadSave(job.result.saveId);
          return;
        }
        pollsRef.current += 1;
        if (pollsRef.current >= 6) {
          setReady(true);
          return;
        }
        setTimeout(poll, 1500);
      } catch {
        if (!cancelled) setReady(true);
      }
    };
    poll();

    return () => { cancelled = true; };
  }, [payload?.saveId, payload?.jobId]);

  const goDone = () => {
    if (payload?.nextScreen) onNavigate(payload.nextScreen);
    else onNavigate('home');
  };

  const goView = () => {
    if (save?._id) onNavigate('save-detail', { id: save._id });
    else goDone();
  };

  const meta = getCategoryMeta(save?.category);
  const stillProcessing = save?.processingStatus === 'processing';

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--linen)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="qs-sheet">
          <div className="qs-handle"></div>

          {!ready ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 48, height: 48, background: 'var(--coral)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', animation: 'qs-spin 1s linear infinite',
                }}
              >
                <i className="ti ti-loader" style={{ fontSize: 25, color: '#fff' }}></i>
              </div>
              <div className="qs-st" style={{ marginBottom: 6 }}>{steps[step]}</div>
              <div className="qs-ex">{step + 1} of {steps.length}</div>
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
                  <div style={{ marginBottom: 4 }}>
                    <span className={`chip ${meta.chipClass}`} style={{ fontSize: 10 }}>{meta.emoji} {meta.label}</span>
                  </div>
                  <div className="qs-ex">
                    {stillProcessing
                      ? "We're still figuring out the details — check back soon."
                      : (save?.aiAnalysis?.summary || save?.description || 'Saved for later.')}
                  </div>
                </div>
              </div>

              <div className="qs-btns">
                <button className="qs-bp" onClick={goView}>View Save</button>
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
