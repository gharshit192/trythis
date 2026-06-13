// <SmartImage> — renders an <img> and lazily re-fetches a fresh CDN URL
// via POST /saves/:id/refresh-thumb when the browser hits 403/404 on the
// cached URL (common for Instagram thumbnails which expire after ~4 days).
//
// Usage: <SmartImage saveId={save._id} src={save.image} alt={...} />

import { useEffect, useRef, useState } from 'react';
import api from '../api';

export default function SmartImage({ saveId, src, alt = '', style, className, fallback }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const triedRefresh = useRef(false);

  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
    triedRefresh.current = false;
  }, [src]);

  const handleError = async () => {
    if (triedRefresh.current || !saveId) {
      setFailed(true);
      return;
    }
    triedRefresh.current = true;
    try {
      const res = await api.refreshThumb(saveId);
      if (res.status === 'success' && res.data.image) {
        setCurrentSrc(res.data.image);
        return;
      }
    } catch {
      // fall through
    }
    setFailed(true);
  };

  if (!currentSrc || failed) {
    return fallback || (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dune)', color: 'var(--slate)', fontSize: 25, ...style }} className={className}>
        🖼️
      </div>
    );
  }

  return <img src={currentSrc} alt={alt} style={style} className={className} onError={handleError} />;
}
