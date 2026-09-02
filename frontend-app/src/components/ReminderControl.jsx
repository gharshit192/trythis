import { useState } from 'react';
import Icon from './Icon';
import Chip from './Chip';

// "Remind me" on any save (ADR 0016 generalised): quick spans, a date, or off.
// Writes Save.resurfaceAt; the resurface_due trigger fires it once on the day.
const SPANS = [['1w', 'In a week', 7], ['1m', 'In a month', 30], ['3m', '3 months', 91], ['6m', '6 months', 182]];
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function ReminderControl({ value, onChange, dark }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = async (date) => { setBusy(true); try { await onChange(date); } finally { setBusy(false); setOpen(false); } };
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d.toISOString(); };
  const fg = dark ? '#fff' : 'var(--ink)';
  const mute = dark ? 'rgba(255,255,255,.6)' : 'var(--mute)';

  return (
    <div style={{ padding: '13px 14px', borderRadius: 12, background: dark ? 'rgba(255,255,255,.1)' : 'var(--card)', border: dark ? '1px solid rgba(255,255,255,.16)' : '1px solid var(--line)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: fg }}>
        <span style={{ color: value ? 'var(--teal)' : mute }}><Icon name="clock" size={20} stroke={1.7} /></span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{value ? `Reminder on ${fmt(value)}` : 'Remind me'}</span>
          <span style={{ fontSize: 12.5, color: mute }}>{value ? 'We bring this back that morning' : 'A week, a month, or a date you pick'}</span>
        </span>
        <span style={{ color: mute, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><Icon name="forward" size={16} /></span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {SPANS.map(([k, label, n]) => <Chip key={k} small onClick={() => set(inDays(n))}>{label}</Chip>)}
          <label className="wt-chip sm" style={{ position: 'relative', overflow: 'hidden' }}>
            Pick a date
            <input type="date" min={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && set(new Date(`${e.target.value}T09:00:00`).toISOString())}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
          {value && <Chip small onClick={() => set(null)}>Turn off</Chip>}
          {busy && <span className="wt-spinner" style={{ width: 20, height: 20 }} />}
        </div>
      )}
    </div>
  );
}
