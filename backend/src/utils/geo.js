// GeoJSON helpers for Place.
//
// Places carried `geo: { lat, lng }` and were queried with a hand-rolled
// bounding box, which was wrong twice over: a degree of longitude is
// 111.32 km only at the equator (at Delhi it is ~97.6 km, so a "5 km" box
// reached 5.7 km east-west), and a box's corners sit 1.41x the radius out. A
// 2dsphere index and $nearSphere let Mongo do the spherical maths properly,
// sort by true distance, and actually use an index while doing it.

// GeoJSON is [longitude, latitude] — the opposite order to how everyone says it.
const toPoint = (lat, lng) => (
  lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))
    ? null
    : { type: 'Point', coordinates: [Number(lng), Number(lat)] }
);

const fromPoint = (loc) => (
  loc?.coordinates?.length === 2 ? { lat: loc.coordinates[1], lng: loc.coordinates[0] } : { lat: null, lng: null }
);

// Great-circle distance in metres. Used to report how far a result is once
// Mongo has already done the selecting.
const haversineMetres = (a, b) => {
  if (a?.lat == null || b?.lat == null) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
};

module.exports = { toPoint, fromPoint, haversineMetres };
