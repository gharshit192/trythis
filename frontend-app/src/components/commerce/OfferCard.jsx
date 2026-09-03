import Icon from '../Icon';
import PartnerCTA from './PartnerCTA';

// Transport / activity / ticket: mode, provider, price or "see fares", one line.
const ICON = { flight: 'globe', bus: 'compass', train: 'compass', activity: 'star', ticket: 'calendar' };
export default function OfferCard({ offer }) {
  const mode = offer.metadata?.mode || (offer.type === 'ACTIVITY' ? 'activity' : 'ticket');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
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
  );
}
