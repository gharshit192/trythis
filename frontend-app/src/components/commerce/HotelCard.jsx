import { useState } from 'react';
import Icon from '../Icon';
import PartnerCTA from './PartnerCTA';

// A stay: name, rating, price, distance/area, one reason; then "Compare booking
// options" rows. Text-first like everything else — no hotel photos.
export default function HotelCard({ offer }) {
  const [open, setOpen] = useState(false);
  const meta = [offer.area && offer.area !== offer.title ? offer.area : offer.city, offer.description].filter(Boolean).join(' · ');
  return (
    <div style={{ padding: '13px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="wt-tile place" style={{ flexShrink: 0 }}><Icon name="pin" size={20} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="wt-row-title" style={{ fontSize: 17 }}>{offer.title}</span>
          {meta && <span className="wt-row-meta">{meta}</span>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
            {offer.rating != null && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cat-food)' }}>★ {offer.rating}{offer.ratingCount ? <span style={{ color: 'var(--faint)', fontWeight: 500 }}> ({offer.ratingCount})</span> : null}</span>}
            {offer.priceLabel && <span style={{ fontSize: 14, fontWeight: 600 }}>{offer.priceLabel}</span>}
            {offer.reason && <span style={{ fontSize: 12.5, color: 'var(--teal-d)' }}>{offer.reason}</span>}
          </div>
        </div>
        <PartnerCTA href={offer.href} label={offer.provider === 'suggested' || offer.provider === 'links' ? 'Search' : 'View'} small primary />
      </div>
      {(offer.options || []).length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', fontSize: 13.5, fontWeight: 500 }}>
            Compare booking options<span style={{ color: 'var(--faint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'flex' }}><Icon name="forward" size={16} /></span>
          </button>
          {open && offer.options.map((o) => (
            <div key={o.provider} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{o.provider}</span>
              <span style={{ fontSize: 13.5, color: o.priceLabel ? 'var(--ink)' : 'var(--faint)', fontWeight: o.priceLabel ? 600 : 400 }}>{o.priceLabel || 'See price'}</span>
              <PartnerCTA href={o.href} label="View" small />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
