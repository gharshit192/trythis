import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

// Question 1 of 2 (ADR 0014): where "near you" should mean. Nothing else is asked
// that behaviour can infer later.
const CITIES = [
  { name: 'Delhi NCR', ready: true,  note: 'Fully mapped' },
  { name: 'Mumbai',    ready: false, note: 'Coming soon · your saves still work' },
  { name: 'Bengaluru', ready: false, note: 'Coming soon · your saves still work' },
];

function Progress({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 34 }}>
      <div className="wt-progress"><i style={{ width: `${step * 50}%` }} /></div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--faint)' }}>{step} of 2</span>
    </div>
  );
}
export { Progress };

export default function OnboardingCity({ onNavigate }) {
  const [city, setCity] = useState(CITIES[0].name);
  const [typed, setTyped] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = async (chosen) => {
    setSaving(true);
    try { await api.updateOnboarding({ city: chosen, currentStep: 1 }); } catch {}
    setSaving(false);
    onNavigate('onboarding-interests');
  };

  const useLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { await api.updateLocation(pos.coords.latitude, pos.coords.longitude, null); } catch {}
      localStorage.setItem('location_requested', 'true');
      setLocating(false);
      next(city);
    }, () => { localStorage.setItem('location_requested', 'denied'); setLocating(false); }, { timeout: 10000 });
  };

  return (
    <div className="wt-screen">
      <Progress step={1} />
      <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>Where are you<br />mostly around?</h1>
      <p className="wt-sub" style={{ marginBottom: 26 }}>So "near you" actually means near you.</p>

      <button type="button" onClick={useLocation} disabled={locating}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 56, padding: '0 16px', marginBottom: 22, border: '1.5px solid var(--teal)', borderRadius: 12, background: 'var(--teal-soft)', color: 'var(--teal)', cursor: 'pointer', fontSize: 16, fontWeight: 600, textAlign: 'left' }}>
        <Icon name="locate" size={20} />{locating ? 'Finding you…' : 'Use my current location'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} /><span style={{ fontSize: 12.5, color: 'var(--faint)' }}>or pick one</span><div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <div className="wt-search" style={{ height: 50, marginBottom: 18 }}>
        <Icon name="search" size={18} stroke={1.9} />
        <input value={typed} onChange={(e) => { setTyped(e.target.value); setCity(e.target.value); }} placeholder="Search a city" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {CITIES.map((c) => {
          const on = city === c.name;
          return (
            <button key={c.name} type="button" onClick={() => { setCity(c.name); setTyped(''); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, padding: '0 16px', border: on ? '1.5px solid var(--teal)' : '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontSize: 12.5, color: c.ready ? 'var(--teal)' : 'var(--faint)', fontWeight: c.ready ? 500 : 400 }}>{c.note}</span>
              </span>
              {on && <span style={{ color: 'var(--teal)' }}><Icon name="check" size={20} stroke={2.4} /></span>}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Button onClick={() => next(city)} disabled={saving || !city.trim()}>Continue</Button>
      </div>
    </div>
  );
}
