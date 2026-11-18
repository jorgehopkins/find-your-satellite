// Draws the Trail on the map as a polyline, growing with each new ISS position from the feed.
import { map } from "./map.js";
import { feed } from "./feed.js";
import { createTrail } from "./trail.js";

const trail = createTrail();
const line = L.polyline([], { color: "#e63946", weight: 2, opacity: 0.8, interactive: false }).addTo(map);

feed.subscribe(({ position, outOfDate }) => {
  if (outOfDate || !position) return;
  if (trail.add(position)) line.setLatLngs(trail.segments());
});
