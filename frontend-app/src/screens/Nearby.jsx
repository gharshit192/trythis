import { useState, useEffect } from 'react';
import api from '../api';
import { getCategoryMeta } from '../categoryMeta';

const RADIUS_OPTIONS = [1000, 2000, 5000, 10000];

const formatDistance = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

function NearbyThumb({ save }) {
  const meta = getCategoryMeta(save.category);
  if (save.thumbnail) {
    return <div className="nr-th" style={{ backgroundImage: `url(${save.thumbnail})` }} />;
  }
  return (
    <div className={`nr-th ${meta.gradientClass}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 19 }}>
      <i className={`ti ${meta.icon}`}></i>
    </div>
  );
}

// Purely decorative pin positions for the map box
const PIN_POSITIONS = [
  { top: '22%', left: '28%' },
  { top: '50%', left: '60%' },
  { top: '70%', left: '30%' },
];

export default function Nearby({ onNavigate, nearbySaves: initialNearbySaves = [] }) {
  const [saves, setSaves] = useState(initialNearbySaves);
  const [loading, setLoading] = useState(true);
  const [radiusIdx, setRadiusIdx] = useState(1); // default 2km
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const result = await api.getNearbySaves(lat, lng, RADIUS_OPTIONS[radiusIdx]);
          if (result.status === 'success') setSaves(result.saves || []);
        } catch {
          // keep whatever we had
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLocationDenied(true);
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [radiusIdx]);

  const cycleRadius = () => setRadiusIdx((i) => (i + 1) % RADIUS_OPTIONS.length);
  const radiusLabel = RADIUS_OPTIONS[radiusIdx] >= 1000
    ? `${RADIUS_OPTIONS[radiusIdx] / 1000} km`
    : `${RADIUS_OPTIONS[radiusIdx]} m`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
      <div className="h-header">
        <div className="h-greet">Saves near you</div>
        <div className="h-title">Nearby</div>
      </div>

      <div className="nr-fr" style={{ paddingTop: 8 }}>
        <div className="nr-pill">📍 Near Me ON</div>
        <button className="nr-rad" onClick={cycleRadius}>{radiusLabel} ▾</button>
      </div>

      <div className="map-box">
        <div className="map-grid"></div>
        <div className="mr-h" style={{ top: '37%', left: 0, right: 0 }}></div>
        <div className="mr-h" style={{ top: '64%', left: 0, right: 0, height: 2, opacity: 0.6 }}></div>
        <div className="mr-v" style={{ left: '38%', top: 0, bottom: 0 }}></div>
        <div className="mr-v" style={{ left: '67%', top: 0, bottom: 0, width: 2, opacity: 0.6 }}></div>
        {saves.slice(0, 3).map((save, i) => (
          <div key={save._id} className="mpin" style={{ background: 'var(--coral)', ...PIN_POSITIONS[i] }}>
            <div className="mpin-i"></div>
          </div>
        ))}
        <div className="myou" style={{ top: '40%', left: '42%' }}></div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', fontSize: 14 }}>
          Finding saves nearby...
        </div>
      ) : locationDenied ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: '40px 28px' }}>
          <i className="ti ti-map-pin-off" style={{ fontSize: 40, color: '#ccc' }}></i>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Location access needed</div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>Enable location to see your saves near you.</div>
        </div>
      ) : saves.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: '40px 28px' }}>
          <i className="ti ti-map-pin-search" style={{ fontSize: 40, color: '#ccc' }}></i>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>No saves nearby yet</div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>Places you save with a location will show up here when you're close by.</div>
        </div>
      ) : (
        <>
          <div className="nr-cnt">{saves.length} place{saves.length !== 1 ? 's' : ''} nearby</div>
          <div className="nr-list" style={{ paddingBottom: 20 }}>
            {saves.map((save) => (
              <div key={save._id} className="nr-item" onClick={() => onNavigate('save-detail', { id: save._id })}>
                <NearbyThumb save={save} />
                <div className="nr-info">
                  <div className="nr-nm">{save.title}</div>
                  <div className="nr-sub">
                    {save.extractedLocation?.name || save.extractedLocation?.city || getCategoryMeta(save.category).label}
                  </div>
                </div>
                <div className="nr-d">{formatDistance(save.distanceMetres)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
