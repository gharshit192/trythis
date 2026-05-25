import { useState, useEffect } from 'react';

export default function FirstSaveSuccess({ onNavigate, payload }) {
  const [step, setStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const steps = ['Reading your save…', 'Figuring out what it is…', 'Organising it for you…'];

  useEffect(() => {
    if (step < steps.length) {
      const timer = setTimeout(() => setStep(step + 1), 1200);
      return () => clearTimeout(timer);
    } else if (step === steps.length) {
      const timer = setTimeout(() => setIsProcessing(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [step, steps.length]);

  return (
    <div className="phone-frame">
      <div style={{ background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        {isProcessing ? (
          // Processing animation with steps
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                background: 'var(--forest, #1B3A2F)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite'
              }}
            >
              <i className="ti ti-loader" style={{ fontSize: 32, color: 'white' }}></i>
            </div>
            {step < steps.length ? (
              <>
                <p style={{ fontSize: 14, color: '#1a1a1a', marginBottom: 8 }}>
                  {steps[step]}
                </p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {step + 1} of {steps.length}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: '#1a1a1a', marginBottom: 8 }}>
                  Almost done…
                </p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  Finalizing your save
                </p>
              </>
            )}
          </div>
        ) : (
          // Success card
          <div style={{ width: '100%', maxWidth: 320 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: '#E1F5EE',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 32, color: '#0F6E56' }}></i>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>
                {payload?.isFirstSave ? 'First save done!' : 'All set!'}
              </h2>
              <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
                {payload?.isFirstSave
                  ? "We'll remind you about this at the right time."
                  : 'Your save is ready to go'}
              </p>
            </div>

            <button
              onClick={() => {
                if (payload?.nextScreen) {
                  onNavigate(payload.nextScreen);
                } else {
                  onNavigate('home');
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--forest, #1B3A2F)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Continue
            </button>
          </div>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
