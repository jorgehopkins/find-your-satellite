// Pure text helpers for the readout and the notice. No DOM here, so they can be tested under Node.

/** "30 s", "2 min", "1 h": whole units, rounded down. */
export function formatAge(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
}

/**
 * The ISS feed message for a feed state, or "" when the data is fresh.
 * `elapsedSeconds` is the time since the state was received, so the age keeps growing between polls.
 */
export function noticeText(state, elapsedSeconds = 0) {
  if (!state) return "";
  if (!state.position) return "No ISS position has been received yet";
  if (!state.outOfDate) return "";
  return `Out of date: last updated ${formatAge((state.ageSeconds ?? 0) + elapsedSeconds)} ago`;
}

const DASH = "–";

/** The readout strings for a position, or dashes when there is none. */
export function readoutText(position) {
  if (!position) return { latitude: DASH, longitude: DASH, altitude: DASH, speed: DASH };
  return {
    latitude: `${position.latitude.toFixed(2)}°`,
    longitude: `${position.longitude.toFixed(2)}°`,
    altitude: `${position.altitudeKm.toFixed(1)} km`,
    speed: `${Math.round(position.speedKmh).toLocaleString("en-US")} km/h`,
  };
}
