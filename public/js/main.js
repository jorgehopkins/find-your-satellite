// Entry point: wires the ISS feed to the marker, the readout, the notice and the Track ISS button.
// Later features add their imports here.
import { map } from "./map.js";
import { feed } from "./feed.js";
import { interpolatePosition } from "./animate.js";
import { noticeText, readoutText } from "./format.js";
import "./tracking.js";
import "./location.js";
import "./trail-layer.js";

const MOVE_MS = 5000; // about the poll interval, so the marker keeps moving until the next update

const $ = (id) => document.getElementById(id);
const readout = {
  latitude: $("readout-latitude"),
  longitude: $("readout-longitude"),
  altitude: $("readout-altitude"),
  speed: $("readout-speed"),
};
const notice = $("notice");
const trackButton = $("track-button");

// --- Marker ---
const issIcon = L.divIcon({
  className: "iss-icon",
  html: '<span class="iss-marker" role="img" aria-label="International Space Station"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
let marker = null;
let shown = null; // where the marker is drawn now: { latitude, longitude }
let frame = null;

function moveMarkerTo(target) {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  if (!marker) {
    shown = { ...target };
    marker = L.marker([shown.latitude, shown.longitude], { icon: issIcon, title: "International Space Station", alt: "International Space Station", keyboard: false }).addTo(map);
    return;
  }
  const from = { ...shown };
  const startedAt = performance.now();
  const step = (time) => {
    const elapsed = Math.max(0, time - startedAt);
    shown = interpolatePosition(from, target, elapsed, MOVE_MS);
    marker.setLatLng([shown.latitude, shown.longitude]);
    frame = elapsed < MOVE_MS ? requestAnimationFrame(step) : null;
  };
  frame = requestAnimationFrame(step);
}

// --- Readout, notice, button ---
let state = null;
let stateAt = 0;

function renderNotice() {
  notice.textContent = state ? noticeText(state, (Date.now() - stateAt) / 1000) : "";
}

feed.subscribe((next) => {
  state = next;
  stateAt = Date.now();
  const text = readoutText(next.position);
  for (const key of Object.keys(readout)) readout[key].textContent = text[key];
  renderNotice();
  if (next.position) {
    moveMarkerTo(next.position);
    trackButton.disabled = false;
  }
});

// The age keeps growing between polls.
setInterval(renderNotice, 1000);

feed.start();
