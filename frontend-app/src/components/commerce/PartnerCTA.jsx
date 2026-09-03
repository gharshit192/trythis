import { API_BASE_URL } from '../../api/client';
import Icon from '../Icon';

// "View on {partner}" → our /go redirect on the API host (logs the click, then the partner).
export const goUrl = (href) => (href ? (href.startsWith('/go/') ? `${API_BASE_URL}${href}` : href) : null);

export default function PartnerCTA({ href, label = 'View', small, primary }) {
  const url = goUrl(href);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer sponsored"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: small ? '7px 12px' : '10px 14px', borderRadius: 999, fontSize: small ? 13 : 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
        background: primary ? 'var(--teal)' : 'var(--card)', color: primary ? '#fff' : 'var(--teal-d)', border: primary ? 0 : '1px solid var(--line)' }}>
      {label}<Icon name="forward" size={14} stroke={2.2} />
    </a>
  );
}
