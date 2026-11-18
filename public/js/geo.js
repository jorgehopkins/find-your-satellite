// Pure geometry: is the ISS above the visitor's horizon? No DOM, no Leaflet.
const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle angle (radians) between two points, by the haversine formula. Longitude differences wrap naturally.
function centralAngle(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Geometric horizon, with the visitor taken to be at sea level: the ISS is above the horizon when the angle between the
// visitor and the ISS's sub-point is less than acos(R / (R + altitude)). About 20.6° (2300 km) at 420 km.
export function isAboveHorizon(visitor, iss) {
  const limit = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + iss.altitudeKm));
  return centralAngle(visitor, iss) < limit;
}
