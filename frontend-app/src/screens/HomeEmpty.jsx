import SearchBar from '../components/SearchBar';

const getGreeting = (userName) => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}${userName ? `, ${userName}` : ''}`;
};

export default function HomeEmpty({ onNavigate }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user?.name?.split(' ')[0] || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
      <div className="h-header">
        <div className="h-greet">{getGreeting(userName)} 👋</div>
        <div className="h-title">What do you<br />wanna try?</div>
      </div>

      <SearchBar onClick={() => onNavigate('search')} style={{ margin: '0 var(--pad-screen) 8px' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px' }}>
        <div className="emp-art">
          <div className="emp-bk">
            <div className="emp-line" style={{ top: 22, left: 10, right: 10 }}></div>
            <div className="emp-line" style={{ top: 32, left: 10, width: 30 }}></div>
            <div className="emp-line" style={{ top: 42, left: 10, right: 10 }}></div>
          </div>
          <div className="emp-sp" style={{ top: -6, right: 2 }}></div>
          <div className="emp-sp" style={{ bottom: 10, right: -4, background: 'var(--coral)', width: 5, height: 5 }}></div>
        </div>

        <div className="emp-title">Nothing saved yet</div>
        <div className="emp-sub">Share any Instagram reel to Wanna Try and we'll remember it for you.</div>

        <button className="emp-cta" onClick={() => onNavigate('onboarding')}>See how it works</button>

        <div className="emp-steps">
          <div className="emp-step">
            <div className="emp-snum">1</div>
            <div className="emp-stxt">Share a reel from Instagram</div>
          </div>
          <div className="emp-arr">→</div>
          <div className="emp-step">
            <div className="emp-snum">2</div>
            <div className="emp-stxt">AI reads and saves it</div>
          </div>
          <div className="emp-arr">→</div>
          <div className="emp-step">
            <div className="emp-snum">3</div>
            <div className="emp-stxt">Find it when you need it</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div onClick={() => onNavigate('add-save')}
             style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: 16, padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 23, flexShrink: 0 }}>🔗</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>Save from web</p>
            <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>Paste a URL or use our browser extension</p>
          </div>
        </div>

        <div onClick={() => onNavigate('add-save')}
             style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: 16, padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 23, flexShrink: 0 }}>📸</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>Screenshot</p>
            <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>Capture and save images from your device</p>
          </div>
        </div>

        <div onClick={() => onNavigate('add-save')}
             style={{ background: 'var(--paper)', border: '0.5px solid var(--hairline)', borderRadius: 16, padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 23, flexShrink: 0 }}>✍️</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>Add manually</p>
            <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>Create a save with your own notes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
