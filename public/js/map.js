// The Leaflet map, created once. Other modules import `map` from here.
// `L` is the global set by /vendor/leaflet/leaflet.js. Every Leaflet interaction (drag, wheel, +/-, pinch) stays on.
export const map = L.map("map", { worldCopyJump: true });

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

map.setView([20, 0], 2);
