// Wires the visitor's Location to the page: a "you" marker, the first view and the "above your horizon" line.
// The Location is never sent anywhere and never logged. One read on load; no watching.
import { map } from "./map.js";
import { feed } from "./feed.js";
import { createLocationController } from "./location-controller.js";

const youIcon = L.divIcon({
  className: "you-icon",
  html: '<span class="you-marker" role="img" aria-label="You are here"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const trackButton = document.getElementById("track-button");

createLocationController({
  geolocation: navigator.geolocation,
  secure: window.isSecureContext !== false,
  map,
  feed,
  horizon: document.getElementById("readout-horizon"),
  notice: document.getElementById("location-notice"),
  addMarker: (latlng) => L.marker(latlng, { icon: youIcon, title: "You are here", alt: "You are here", keyboard: false }).addTo(map),
  isTracking: () => trackButton.textContent.trim() === "Tracking ISS" || trackButton.getAttribute("aria-pressed") === "true",
});
