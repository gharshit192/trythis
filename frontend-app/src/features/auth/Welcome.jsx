import Icon from '../../components/Icon';
import Button from '../../components/Button';

// First screen for a signed-out user. Full-bleed teal is one of the three dark
// moments the design allows (docs/design-system.md §6).
const TILES = [
  { top: 96,  left: -34, w: 186, h: 246, r: -8, bg: 'linear-gradient(150deg,#1C8F7E,#0C5F5E)' },
  { top: 52,  left: 176, w: 172, h: 228, r: 6,  bg: 'linear-gradient(150deg,#D8A945,#A66F2A)' },
  { top: 300, left: 118, w: 196, h: 200, r: -3, bg: 'linear-gradient(150deg,#8E7BB0,#5C4C85)' },
  { top: 268, left: -48, w: 150, h: 172, r: 9,  bg: 'linear-gradient(150deg,#A8724A,#6F4529)' },
];

export default function Welcome({ onNavigate }) {
  return (
    <div className="wt-screen dark" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} aria-hidden="true">
        {TILES.map((t, i) => (
          <div key={i} style={{ position: 'absolute', top: t.top, left: t.left, width: t.w, height: t.h, borderRadius: 18, background: t.bg, transform: `rotate(${t.r}deg)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,90,89,.35) 0%, rgba(10,90,89,.72) 46%, #0A5A59 74%)' }} />
      </div>

      <div style={{ position: 'relative', marginTop: 'auto', padding: '0 28px 44px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 22, color: 'var(--sand)' }}>
          <Icon name="bookmark" size={22} stroke={1.7} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase' }}>Wanna Try</span>
        </div>
        <h1 className="wt-title" style={{ fontSize: 44, lineHeight: 1.04, letterSpacing: '-.01em', color: '#fff', marginBottom: 16 }}>Everything you<br />saved, actually<br />done.</h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.5, color: 'rgba(255,255,255,.76)', margin: '0 0 32px', maxWidth: 300 }}>Send us a reel, a link, a screenshot. We read it, remember it, and bring it back when you can go.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <Button onDark onClick={() => onNavigate('signup')}>Get started</Button>
          <Button onDark variant="secondary" onClick={() => onNavigate('login')}>I already have an account</Button>
        </div>
      </div>
    </div>
  );
}
