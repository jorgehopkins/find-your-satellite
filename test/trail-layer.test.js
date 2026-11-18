import { beforeEach, describe, expect, it, vi } from "vitest";

let listener;
const fakeMap = { id: "map" };
vi.mock("../public/js/map.js", () => ({ map: fakeMap }));
vi.mock("../public/js/feed.js", () => ({ feed: { subscribe: (fn) => { listener = fn; } } }));

const polylines = [];
beforeEach(() => {
  polylines.length = 0;
  globalThis.L = {
    polyline: (latlngs, opts) => {
      const line = { latlngs, opts, addedTo: null, setLatLngs(v) { this.latlngs = v; return this; }, addTo(m) { this.addedTo = m; return this; } };
      polylines.push(line);
      return line;
    },
  };
  vi.resetModules();
});

const pos = (latitude, longitude, timestamp) => ({ latitude, longitude, timestamp });
const update = (position, outOfDate = false) => ({ position, outOfDate, ageSeconds: 0, error: null });

describe("trail layer (AC-10)", () => {
  it("is an empty polyline on the map when the page opens", async () => {
    await import("../public/js/trail-layer.js");
    expect(polylines).toHaveLength(1);
    expect(polylines[0].addedTo).toBe(fakeMap);
    expect(polylines[0].latlngs).toEqual([]);
  });
  it("adds only new, fresh positions", async () => {
    await import("../public/js/trail-layer.js");
    const line = polylines[0];
    listener(update(null));
    expect(line.latlngs).toEqual([]);
    listener(update(pos(1, 1, 1)));
    expect(line.latlngs).toEqual([[[1, 1]]]);
    listener(update(pos(1, 1, 1)));
    listener(update(pos(2, 2, 2), true));
    expect(line.latlngs).toEqual([[[1, 1]]]);
    listener(update(pos(2, 2, 2)));
    expect(line.latlngs).toEqual([[[1, 1], [2, 2]]]);
  });
});
