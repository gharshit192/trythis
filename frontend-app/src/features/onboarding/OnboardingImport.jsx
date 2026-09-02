import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import Banner from '../../components/Banner';

// The cold-start fix (ADR 0014): the user already has hundreds of saves in
// Instagram. Bring them in and the app starts full. Skipping falls back to the
// template saves in DemoSaves.
const OPTIONS = [
  { key: 'share',   icon: 'instagram', kind: 'place', title: 'Share from Instagram', text: 'Open Saved, select a batch, Share → Wanna Try' },
  { key: 'shots',   icon: 'image',     kind: 'shop',  title: 'Upload screenshots',   text: 'We read every place out of a grid of screenshots' },
  { key: 'links',   icon: 'link',      kind: 'learn', title: 'Paste links',          text: 'Reels, Shorts, articles — as many as you like' },
];

export default function OnboardingImport({ onNavigate }) {
  const finish = async (target, payload) => {
    try { await api.updateOnboarding({ completed: true }); } catch {}
    onNavigate(target, payload);
  };

  return (
    <div className="wt-screen">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 26 }}>
        <button type="button" onClick={() => finish('demoSaves')} style={{ background: 'none', border: 0, fontSize: 15, fontWeight: 500, color: 'var(--faint)', cursor: 'pointer' }}>Skip</button>
      </div>
      <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>You've already<br />saved hundreds<br />of these.</h1>
      <p className="wt-sub" style={{ marginBottom: 26 }}>Bring them over and Wanna Try starts full, not empty.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OPTIONS.map((o, i) => (
          <button key={o.key} type="button" onClick={() => finish('add-save', { mode: o.key })}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '17px 16px', border: i === 0 ? '1.5px solid var(--teal)' : '1px solid var(--line)', borderRadius: 14, background: 'var(--card)', cursor: 'pointer', textAlign: 'left' }}>
            <span className={`wt-tile ${o.kind}`}><Icon name={o.icon} size={22} stroke={1.7} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{o.title}</span>
              <span style={{ fontSize: 13.5, color: 'var(--mute)', lineHeight: 1.35 }}>{o.text}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <Banner warm icon="lock">Private by default. Wanna Try never posts, follows, or messages anyone for you.</Banner>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Button onClick={() => finish('add-save', { mode: 'share' })}>Bring my saves in</Button>
      </div>
    </div>
  );
}
