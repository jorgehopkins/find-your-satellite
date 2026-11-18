// The visitor's Location, with every dependency passed in so it runs under Node with fakes.
// The Location stays in this browser: it is only used to place a marker, centre the map and call isAboveHorizon.
// It is never put in a request, a log line or the console.
import { isAboveHorizon } from "./geo.js";

export const GEOLOCATION_TIMEOUT_MS = 10000;
export const FIRST_VIEW_ZOOM = 5; // about city level

const PERMISSION_DENIED = 1;

export const NOTICES = {
  denied: "Location is blocked, so the map shows the whole world and we can't tell if the ISS is above your horizon.",
  unavailable: "We couldn't get your location, so the map shows the whole world and we can't tell if the ISS is above your horizon.",
  unsupported: "This browser can't share a location with this page, so the map shows the whole world and we can't tell if the ISS is above your horizon.",
};

export function createLocationController({ geolocation, secure = true, map, feed, horizon, notice, addMarker, isTracking = () => false }) {
  let location = null; // { latitude, longitude }
  let issPosition = null; // the latest position from the feed, also when out of date
  let dragged = false;

  map.on("dragstart", () => {
    dragged = true;
  });

  function renderHorizon() {
    if (!location || !issPosition) {
      horizon.hidden = true;
      return;
    }
    horizon.textContent = `Above your horizon: ${isAboveHorizon(location, issPosition) ? "yes" : "no"}`;
    horizon.hidden = false;
  }

  feed.subscribe((state) => {
    issPosition = state.position;
    renderHorizon();
  });

  function granted(coords) {
    location = { latitude: coords.latitude, longitude: coords.longitude };
    notice.textContent = "";
    addMarker([location.latitude, location.longitude]);
    if (!dragged && !isTracking()) map.setView([location.latitude, location.longitude], FIRST_VIEW_ZOOM);
    renderHorizon();
  }

  function refused(error) {
    notice.textContent = error && error.code === PERMISSION_DENIED ? NOTICES.denied : NOTICES.unavailable;
  }

  if (!secure || !geolocation || typeof geolocation.getCurrentPosition !== "function") {
    notice.textContent = NOTICES.unsupported;
  } else {
    try {
      geolocation.getCurrentPosition((position) => granted(position.coords), refused, {
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 300000,
        enableHighAccuracy: false,
      });
    } catch {
      refused(null);
    }
  }
}
