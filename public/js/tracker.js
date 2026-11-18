// The decision logic for the Track ISS button. Plain module: no Leaflet and no DOM, so it can be tested under Node.
// `view` is the part of the Leaflet map it needs: panTo, setView, getZoom, getCenter.

/** Zoom 4 is about continent level. Starting to track zooms in to at least this. */
export const TRACK_MIN_ZOOM = 4;

/** Pan duration in seconds, about the 5 s refresh, so the view moves in step with the marker. */
const PAN_SECONDS = 5;

/** The copy of longitude `lon` (shifted by whole turns of 360°) nearest `centerLng`. */
export function nearestLongitude(lon, centerLng) {
  return lon + 360 * Math.round((centerLng - lon) / 360);
}

export function createTracker({ view, onChange = () => {} }) {
  let on = false;
  let last = null; // the last position received, even if out of date

  function latlngFor(position) {
    return [position.latitude, nearestLongitude(position.longitude, view.getCenter().lng)];
  }

  function set(next) {
    if (on === next) return;
    on = next;
    onChange(on);
  }

  function start() {
    // Once, when tracking starts: move to the ISS and, if zoomed out beyond continent level, zoom in.
    if (last) view.setView(latlngFor(last), Math.max(view.getZoom(), TRACK_MIN_ZOOM));
  }

  return {
    isOn: () => on,
    toggle() {
      set(!on);
      if (on) start();
    },
    /** Takes each state from the feed. Moves the map only when tracking is on and the position is fresh. */
    onUpdate(state) {
      if (state?.position) last = state.position;
      if (!on || !state?.position || state.outOfDate) return;
      view.panTo(latlngFor(state.position), { animate: true, duration: PAN_SECONDS, easeLinearity: 1 });
    },
    /** The visitor dragged the map. */
    onUserDrag() {
      set(false);
    },
  };
}
