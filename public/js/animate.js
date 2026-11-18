// Pure interpolation for the ISS marker.

/** Wraps a longitude into [-180, 180]. */
function wrapLongitude(lon) {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && lon > 0 ? 180 : wrapped;
}

/**
 * The position `elapsedMs` into a move of `durationMs` from `from` to `to`, moving in a straight line,
 * the short way round the ±180° line. Returns `to` once the move is over.
 */
export function interpolatePosition(from, to, elapsedMs, durationMs) {
  if (!(durationMs > 0) || elapsedMs >= durationMs) return { latitude: to.latitude, longitude: to.longitude };
  const t = Math.max(0, elapsedMs) / durationMs;
  const dLon = ((((to.longitude - from.longitude + 180) % 360) + 360) % 360) - 180;
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: wrapLongitude(from.longitude + dLon * t),
  };
}
