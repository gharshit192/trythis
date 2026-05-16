export default function Onboarding({ step = 1, onNavigate }) {
  const screens = [
    {
      icon: 'ti-bookmark',
      title: 'Save anything in seconds',
      description: 'Links, screenshots, ideas — capture whatever catches your eye.',
      color: 'var(--sand)'
    },
    {
      icon: 'ti-sparkles',
      title: 'AI sorts it for you',
      description: 'Smart collections form automatically based on what you save.',
      color: 'var(--sage)'
    },
    {
      icon: 'ti-bell',
      title: 'Brought back when it matters',
      description: 'Get reminded at the perfect moment to try what you saved.',
      color: 'var(--clay)'
    }
  ];

  const current = screens[step - 1] || screens[0];

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 20px 32px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: current.color, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <i className={`ti ${current.icon}`} style={{ fontSize: '40px', color: 'var(--paper)' }}></i>
          </div>
          <h1 className="display" style={{ fontSize: '28px', textAlign: 'center', marginBottom: '12px' }}>{current.title}</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)', textAlign: 'center', lineHeight: '1.5' }}>{current.description}</p>
        </div>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: step === i ? 'var(--forest)' : 'var(--hairline)' }}></div>
          ))}
        </div>

        <button className="btn-primary" onClick={() => step < 3 ? onNavigate(`onboarding-${step + 1}`) : onNavigate('notification-permission')}>
          {step < 3 ? 'Next' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
