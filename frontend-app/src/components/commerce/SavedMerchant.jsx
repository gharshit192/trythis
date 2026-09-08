import { useEffect, useState } from 'react';
import api from '../../api';
import CommerceSection from './CommerceSection';
import OfferCard from './OfferCard';

export default function SavedMerchant({ save }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    let active = true;
    setOffers([]);
    let host;
    try { host = new URL(save.url).hostname; } catch { return undefined; }
    if (!['nykaa.com', 'www.nykaa.com'].includes(host)) return undefined;
    api.getTripOffers(save._id).then((r) => { if (active) setOffers(r?.data?.products || []); }).catch(() => {});
    return () => { active = false; };
  }, [save._id, save.url]);
  if (!offers.length) return null;
  return <CommerceSection title="Your saved product" count={offers.length}
    disclosure={offers.some((o) => o.source === 'affiliate') ? 'Affiliate link · we may earn a commission' : 'Direct merchant link'}>
    {offers.map((o) => <OfferCard key={o.provider} offer={o} />)}
  </CommerceSection>;
}
