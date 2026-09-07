// Formatting helpers shared across features. Each of these used to be
// copy-pasted into several screens with slightly different edge behaviour.

export const relativeTime = (dateString) => {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
};

// When a save was made, in full: the clock time is what tells you which
// afternoon you saved a thing, and the list's "3 days ago" alone never did.
// Today → "today at 2:45 pm"; this week → "Tuesday, 2:45 pm"; older →
// "12 Aug, 2:45 pm"; another year → "12 Aug 2025, 2:45 pm".
export const savedAt = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, ' ');
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${time}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}, ${time}`;
};

export const greeting = (userName) => {
  const hour = new Date().getHours();
  const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}${userName ? `, ${userName}` : ''}`;
};

export const formatDistance = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

export const isVideo = (save) =>
  save.contentType === 'video' || save.source === 'instagram' || save.source === 'youtube';

// Straight-line distance in metres between two lat/lng points (haversine).
export const distanceMetres = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
