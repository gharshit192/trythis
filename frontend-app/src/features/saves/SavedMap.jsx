import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../api';
import Icon from '../../components/Icon';
import Chip from '../../components/Chip';
import { getCategoryTile } from '../../lib/categoryMeta';
import { relativeTime } from '../../lib/format';

// Your Wanna Try on a map (brief §23). OpenStreetMap tiles, one pin per
// located save coloured by category, tap for the item. Same list, different
// view — the toggle lives on the Wanna Try tab.
const HUE = { place: '#0E7C7B', food: '#C99425', shop: '#8B5E3C', learn: '#6B5B95', none: '#6E7B78' };
const STATUS = [['all', 'All'], ['saved', 'Want to try'], ['planned', 'Planning'], ['tried', 'Tried']];
const pinIcon = (kind, on) => L.divIcon({
  className: 'wt-pin',
  html: `<span style="display:block;width:${on ? 22 : 16}px;height:${on ? 22 : 16}px;border-radius:50%;background:${HUE[kind] || HUE.none};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(21,32,30,.35)"></span>`,
  iconSize: [on ? 22 : 16, on ? 22 : 16], iconAnchor: [on ? 11 : 8, on ? 11 : 8],
});
const meIcon = L.divIcon({ className: 'wt-pin', html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#1B6A57;border:3px solid #fff;box-shadow:0 0 0 6px rgba(27,106,87,.2)"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });

export default function SavedMap({ onNavigate }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('all');
  const [active, setActive] = useState(null);
  const mapEl = useRef(null); const map = useRef(null); const layer = useRef(null); const me = useRef(null);

  useEffect(() => { api.getSavesMap().then((r) => setData(r?.status === 'success' ? r.data : { pins: [], total: 0 })).catch(() => setData({ pins: [], total: 0 })); }, []);

  // Build the map once the pins are known; refit when the filter changes.
  useEffect(() => {
    if (!data || !mapEl.current) return undefined;
    if (!map.current) {
      map.current = L.map(mapEl.current, { zoomControl: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
      map.current.attributionControl.setPrefix('');
      map.current.on('click', () => setActive(null));
    }
    if (layer.current) layer.current.remove();
    layer.current = L.layerGroup().addTo(map.current);
    const pins = data.pins.filter((p) => status === 'all' || p.intentStatus === status);
    pins.forEach((p) => {
      const kind = getCategoryTile(p.category).kind;
      L.marker([p.lat, p.lng], { icon: pinIcon(kind, active?._id === p._id) }).addTo(layer.current).on('click', () => setActive(p));
    });
    if (pins.length && !active) {
      const b = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      map.current.fitBounds(b.pad(0.25), { maxZoom: 14, animate: false });
    } else if (!pins.length && !map.current._loaded) map.current.setView([28.6139, 77.209], 11);
    setTimeout(() => map.current && map.current.invalidateSize(), 50);
    return undefined;
  }, [data, status, active]);

  const locate = () => {
    if (!navigator.geolocation || !map.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (me.current) me.current.remove();
      me.current = L.marker(ll, { icon: meIcon }).addTo(map.current);
      map.current.setView(ll, 13);
    }, () => {}, { timeout: 8000, maximumAge: 300000 });
  };

  const counted = data ? data.pins.filter((p) => status === 'all' || p.intentStatus === status).length : 0;
  return (
    <div className="wt-screen has-nav" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{ padding: 'var(--pad-top) var(--pad-screen) 10px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 className="wt-title">Your Wanna Try</h1>
          <button type="button" className="wt-link" onClick={() => onNavigate('saved')} style={{ background: 'none', border: 0, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="bookmark" size={15} />List</button>
        </div>
        <div className="wt-chips">
          {STATUS.map(([id, label]) => <Chip key={id} small on={status === id} onClick={() => { setActive(null); setStatus(id); }}>{label}</Chip>)}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{data ? `${counted} on the map · ${data.total - data.pins.length} without a place` : 'Placing your saves…'}</span>
      </div>
      <div ref={mapEl} style={{ flex: 1, minHeight: 320, background: 'var(--card-2)' }} />
      <button type="button" aria-label="Where am I" onClick={locate}
        style={{ position: 'absolute', right: 16, bottom: active ? 210 : 122, width: 44, height: 44, borderRadius: 22, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(21,32,30,.12)', cursor: 'pointer', zIndex: 3 }}>
        <Icon name="locate" size={20} />
      </button>
      {active && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 104, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 24px rgba(21,32,30,.14)', zIndex: 3, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`wt-tile ${getCategoryTile(active.category).kind}`}><Icon name={getCategoryTile(active.category).icon} size={20} /></span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="wt-row-title" style={{ fontSize: 16.5 }}>{active.title}</span>
            <span className="wt-row-meta">{[getCategoryTile(active.category).label, active.name || active.city, active.priceRange].filter(Boolean).join(' · ')}</span>
            <span style={{ fontSize: 12.5, color: 'var(--teal-d)' }}>{active.intentStatus === 'tried' ? `Tried${active.rating ? ` · ${'★'.repeat(active.rating)}` : ''}` : active.intentStatus === 'planned' ? `Planning${active.plannedFor ? ` · ${new Date(active.plannedFor).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}` : `Saved ${relativeTime(active.createdAt).toLowerCase()}`}{!active.precise ? ' · city-level pin' : ''}</span>
          </div>
          <button type="button" className="wt-iconbtn" aria-label="Open" onClick={() => onNavigate('save-detail', { id: active._id })}><Icon name="forward" size={20} /></button>
        </div>
      )}
      {data && data.pins.length === 0 && (
        <div style={{ position: 'absolute', left: 24, right: 24, top: '45%', textAlign: 'center', zIndex: 3, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px' }}>Nothing on the map yet</p>
          <p className="wt-sub" style={{ margin: 0 }}>Saves with a place get a pin. Save a cafe or a trip and it shows up here.</p>
        </div>
      )}
    </div>
  );
}
