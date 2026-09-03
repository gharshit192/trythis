import { useState } from 'react';
import Icon from '../Icon';
import PartnerCTA from './PartnerCTA';

// Transport / activity / ticket: mode, provider, price or "see fares", one line.
const ICON = { flight: 'globe', bus: 'compass', train: 'compass', activity: 'star', ticket: 'calendar' };
export default function OfferCard({ offer }) {
  const [open, setOpen] = useState(false);
  const mode = offer.metadata?.mode || (offer.type === 'ACTIVITY' ? 'activity' : 'ticket');
  const options = (offer.options || []).filter((o) => o.href);
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="wt-tile learn" style={{ flexShrink: 0 }}><Icon name={ICON[mode] || 'link'} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="wt-row-title" style={{ fontSize: 16.5 }}>{offer.title}</span>
        <span className="wt-row-meta">{[offer.provider !== 'amadeus' ? offer.provider : null, offer.description].filter(Boolean).join(' · ')}</span>
        {offer.reason && <span style={{ fontSize: 12.5, color: 'var(--teal-d)' }}>{offer.reason}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {offer.priceLabel && <span style={{ fontSize: 14, fontWeight: 600 }}>{offer.priceLabel}</span>}
        <PartnerCTA href={offer.href} label={offer.priceLabel ? 'Book' : 'Search'} small primary={!!offer.priceLabel} />
      </div>
    </div>
    {options.length > 1 && (
      <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', fontSize: 13.5, fontWeight: 500 }}>
          Also on {options.slice(1).map((o) => o.provider).join(', ')}<span style={{ color: 'var(--faint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'flex' }}><Icon name="forward" size={16} /></span>
        </button>
        {open && options.map((o) => (
          <div key={o.provider} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ flex: 1, fontSize: 14.5 }}>{o.provider}</span>
            <PartnerCTA href={o.href} label="View" small />
          </div>
        ))}
      </div>
    )}
    </div>
  );
}
