import { useState, useEffect } from 'react';
import api from '../../api';
import Chip from '../Chip';
import CommerceSection from './CommerceSection';
import HotelCard from './HotelCard';
import OfferCard from './OfferCard';

// Stay · Getting there for a trip, from /saves/:id/offers. Dates and guests are
// the only inputs; live prices appear when a provider is connected.
const nextSat = () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); };

export default function CompleteYourTrip({ saveId, defaultNights, origin, compact, onSeeAll }) {
  const [checkIn, setCheckIn] = useState(nextSat());
  const [nights, setNights] = useState(defaultNights || 2);
  const [adults, setAdults] = useState(2);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true; setBusy(true);
    api.getTripOffers(saveId, { checkIn, nights, adults, origin }).then((r) => { if (alive) setData(r?.status === 'success' ? r.data : { destinations: [] }); }).catch(() => alive && setData({ destinations: [] })).finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [saveId, checkIn, nights, adults, origin]);

  const dests = data?.destinations || [];
  const stays = dests.flatMap((d) => d.stays.map((s) => ({ ...s, dest: d.name })));
  const transport = dests.flatMap((d) => d.transport.map((t) => ({ ...t, dest: d.name })));
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  if (compact) {
    const top = stays.filter((s) => s.provider !== 'links').slice(0, 2);
    const ride = transport[0];
    return (
      <CommerceSection title="Complete your trip" count={top.length + (ride ? 1 : 0)} action="See all" onAction={onSeeAll} disclosure={data?.live ? 'Live partner prices · affiliate links' : 'Affiliate links · prices on the partner'}>
        {top.map((s, i) => <HotelCard key={i} offer={s} />)}
        {ride && <OfferCard offer={ride} />}
      </CommerceSection>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mute)' }}>Check-in
          <input type="date" value={checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && setCheckIn(e.target.value)} className="wt-input" style={{ height: 34, padding: '0 10px', fontSize: 13.5, width: 'auto' }} />
        </label>
        <div className="wt-chips">{[1, 2, 3, 5, 7].map((n) => <Chip key={n} small on={nights === n} onClick={() => setNights(n)}>{n} night{n === 1 ? '' : 's'}</Chip>)}</div>
        <div className="wt-chips">{[1, 2, 4].map((n) => <Chip key={n} small on={adults === n} onClick={() => setAdults(n)}>{n} {n === 1 ? 'guest' : 'guests'}</Chip>)}</div>
      </div>
      {busy && <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--mute)', fontSize: 14, padding: '8px 0 16px' }}><span className="wt-spinner" />Checking stays and fares for {fmt(checkIn)}…</div>}
      {!busy && dests.map((d) => (
        <div key={d.name}>
          <CommerceSection title={`Stay in ${d.name}`} count={d.stays.length} disclosure={data?.live ? 'Live prices from partners · we may earn a commission' : 'Prices open on the partner · we may earn a commission'}>
            {d.stays.map((s, i) => <HotelCard key={i} offer={s} />)}
          </CommerceSection>
          <CommerceSection title={`Getting to ${d.name}`} count={d.transport.length} disclosure="Fares open on the partner · some links pay us a commission">
            {d.transport.map((t, i) => <OfferCard key={i} offer={t} />)}
          </CommerceSection>
        </div>
      ))}
      {!busy && !dests.length && <p className="wt-sub" style={{ fontSize: 14.5 }}>Build the day plan first — stays and fares follow the destinations.</p>}
      {!busy && data && !data.live && dests.length > 0 && <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '4px 0 0' }}>Live hotel prices and flight fares switch on once the travel data partner is connected.</p>}
    </div>
  );
}
