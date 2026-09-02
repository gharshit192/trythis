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
