import { describe, expect, it } from "vitest";
import { createTracker, TRACK_MIN_ZOOM, nearestLongitude } from "../public/js/tracker.js";

function setup({ zoom = 2, center = { lat: 0, lng: 0 } } = {}) {
  const calls = [];
  const view = {
    zoom,
    center,
    panTo: (latlng, options) => calls.push({ type: "panTo", latlng, options }),
    setView: (latlng, z) => {
      calls.push({ type: "setView", latlng, zoom: z });
      view.zoom = z;
    },
    getZoom: () => view.zoom,
    getCenter: () => view.center,
  };
  const labels = [];
  const tracker = createTracker({ view, onChange: (on) => labels.push(on) });
  return { tracker, view, calls, labels };
}
const pos = (latitude, longitude) => ({ latitude, longitude });
const fresh = (p) => ({ position: p, outOfDate: false, ageSeconds: 0, error: null });
const stale = (p) => ({ position: p, outOfDate: true, ageSeconds: 120, error: "down" });

describe("tracker", () => {
  it("is off on creation and does not move the map on updates (AC-15)", () => {
    const { tracker, calls } = setup();
    expect(tracker.isOn()).toBe(false);
    tracker.onUpdate(fresh(pos(10, 20)));
    expect(calls).toEqual([]);
  });

  it("centres on the last known position when turned on, then on each new position (AC-16)", () => {
    const { tracker, calls } = setup({ zoom: 5 });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    expect(tracker.isOn()).toBe(true);
    expect(calls).toEqual([{ type: "setView", latlng: [10, 20], zoom: 5 }]);
    tracker.onUpdate(fresh(pos(11, 21)));
    expect(calls[1]).toMatchObject({ type: "panTo", latlng: [11, 21] });
    expect(calls[1].options).toMatchObject({ animate: true, duration: 5, easeLinearity: 1 });
    tracker.onUpdate(fresh(pos(12, 22)));
    expect(calls[2]).toMatchObject({ type: "panTo", latlng: [12, 22] });
  });

  it("does nothing when turned on with no position yet, then centres on the first one", () => {
    const { tracker, calls } = setup({ zoom: 5 });
    tracker.toggle();
    expect(calls).toEqual([]);
    tracker.onUpdate(fresh(pos(1, 2)));
    expect(calls).toHaveLength(1);
    expect(calls[0].latlng).toEqual([1, 2]);
  });

  it("zooms to 4 once when starting below 4 (AC-17)", () => {
    const { tracker, view, calls } = setup({ zoom: 2 });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    expect(calls[0]).toEqual({ type: "setView", latlng: [10, 20], zoom: TRACK_MIN_ZOOM });
    expect(TRACK_MIN_ZOOM).toBe(4);
    view.zoom = 3; // the visitor zooms out afterwards
    tracker.onUpdate(fresh(pos(11, 21)));
    expect(calls[1].type).toBe("panTo");
    expect(view.zoom).toBe(3);
    expect(calls.filter((c) => c.type === "setView")).toHaveLength(1);
  });

  it.each([4, 7])("leaves zoom %i alone (AC-17)", (zoom) => {
    const { tracker, view, calls } = setup({ zoom });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    expect(calls[0].zoom).toBe(zoom);
    tracker.onUpdate(fresh(pos(11, 21)));
    expect(view.zoom).toBe(zoom);
  });

  it("switches off on a second toggle and on a user drag, and stops moving the map (AC-18)", () => {
    const { tracker, calls, labels } = setup({ zoom: 5 });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    tracker.toggle();
    expect(tracker.isOn()).toBe(false);
    tracker.onUpdate(fresh(pos(11, 21)));
    expect(calls).toHaveLength(1);
    tracker.toggle();
    tracker.onUserDrag();
    expect(tracker.isOn()).toBe(false);
    expect(labels).toEqual([true, false, true, false]);
    tracker.onUserDrag(); // already off: nothing happens
    expect(labels).toHaveLength(4);
  });

  it("is not switched off by the tracker's own moves (AC-18)", () => {
    const { tracker } = setup({ zoom: 2 });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    tracker.onUpdate(fresh(pos(11, 21)));
    expect(tracker.isOn()).toBe(true);
  });

  it("stays on and does not move while out of date, and re-centres on the next fresh position (AC-19)", () => {
    const { tracker, calls } = setup({ zoom: 5 });
    tracker.onUpdate(fresh(pos(10, 20)));
    tracker.toggle();
    tracker.onUpdate(stale(pos(10, 20)));
    tracker.onUpdate(stale(pos(10, 20)));
    expect(tracker.isOn()).toBe(true);
    expect(calls).toHaveLength(1);
    tracker.onUpdate(fresh(pos(12, 23)));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ type: "panTo", latlng: [12, 23] });
  });

  it("takes the copy of the world nearest the centre across ±180°", () => {
    expect(nearestLongitude(-179, 175)).toBe(181);
    expect(nearestLongitude(179, -175)).toBe(-181);
    expect(nearestLongitude(20, 0)).toBe(20);
    expect(nearestLongitude(20, 720)).toBe(740);
    const { tracker, calls } = setup({ zoom: 5, center: { lat: 0, lng: 178 } });
    tracker.onUpdate(fresh(pos(0, 178)));
    tracker.toggle();
    tracker.onUpdate(fresh(pos(0, -179)));
    expect(calls[1].latlng).toEqual([0, 181]);
  });
});
