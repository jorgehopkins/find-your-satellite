// Wires the Track ISS button, the map and the feed to the tracker. Thin: the decisions are in tracker.js.
import { map } from "./map.js";
import { feed } from "./feed.js";
import { createTracker } from "./tracker.js";

const button = document.getElementById("track-button");

function render(on) {
  button.textContent = on ? "Tracking ISS" : "Track ISS";
  button.setAttribute("aria-pressed", String(on));
}

const tracker = createTracker({ view: map, onChange: render });
render(false);

// Tracking is first started when there is a position, as main.js keeps the button disabled until then.
button.addEventListener("click", () => tracker.toggle());
feed.subscribe((state) => tracker.onUpdate(state));
// `dragstart` fires for the visitor's drag and touch pan only, never for panTo/setView or zooming.
map.on("dragstart", () => tracker.onUserDrag());
