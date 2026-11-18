import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createLocationController, GEOLOCATION_TIMEOUT_MS } from "../public/js/location-controller.js";
import { isAboveHorizon } from "../public/js/geo.js";
import { createIssFeed } from "../public/js/iss-feed.js";

const VISITOR = { latitude: 51.5072, longitude: -0.1276 };
const issPos = (latitude, longitude) => ({ latitude, longitude, altitudeKm: 420, speedKmh: 27580, timestamp: 1 });
const state = (position, extra = {}) => ({ position, outOfDate: false, ageSeconds: 0, error: null, ...extra });

function fakeFeed() {
  const subs = new Set();
  return { subscribe: (fn) => (subs.add(fn), () => subs.delete(fn)), emit: (s) => subs.forEach((fn) => fn(s)) };
}

function fakeMap() {
  const handlers = {};
  return {
    markers: [],
    views: [],
    on: (name, fn) => ((handlers[name] ||= []).push(fn), undefined),
    fire: (name) => (handlers[name] || []).forEach((fn) => fn()),
    setView(latlng, zoom) {
      this.views.push([latlng, zoom]);
    },
  };
}

function setup({ geolocation, tracking = false, secure = true } = {}) {
  const map = fakeMap();
  const feed = fakeFeed();
  const horizon = { hidden: true, textContent: "" };
  const notice = { textContent: "" };
  const addMarker = vi.fn((latlng) => map.markers.push(latlng));
  const controller = createLocationController({ geolocation, secure, map, feed, horizon, notice, addMarker, isTracking: () => tracking });
  return { map, feed, horizon, notice, addMarker, controller };
}

function grantingGeolocation(coords = VISITOR) {
  const g = { calls: [], pending: null };
  g.getCurrentPosition = (ok, fail, options) => {
    g.calls.push(options);
    g.pending = { grant: () => ok({ coords }), fail };
  };
  return g;
}
function failingGeolocation(code) {
  return {
    getCurrentPosition: (ok, fail) => fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
  };
}

describe("location granted (AC-11)", () => {
  it("adds a you marker, centres the first view once at zoom 5, and asks once with a timeout", () => {
    const geo = grantingGeolocation();
    const { map, addMarker } = setup({ geolocation: geo });
    geo.pending.grant();
    expect(addMarker).toHaveBeenCalledWith([VISITOR.latitude, VISITOR.longitude]);
    expect(map.views).toEqual([[[VISITOR.latitude, VISITOR.longitude], 5]]);
    expect(geo.calls).toHaveLength(1);
    expect(geo.calls[0].timeout).toBe(GEOLOCATION_TIMEOUT_MS);
    expect(GEOLOCATION_TIMEOUT_MS).toBeGreaterThanOrEqual(8000);
    expect(GEOLOCATION_TIMEOUT_MS).toBeLessThanOrEqual(12000);
  });

  it("does not use watchPosition", () => {
    const geo = { ...grantingGeolocation(), watchPosition: vi.fn() };
    setup({ geolocation: geo });
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it("shows yes or no matching isAboveHorizon for the latest feed position, on every update", () => {
    const geo = grantingGeolocation();
    const { feed, horizon, notice } = setup({ geolocation: geo });
    geo.pending.grant();
    expect(horizon.hidden).toBe(true); // no position yet
    for (const pos of [issPos(51, 0), issPos(-40, 100), issPos(52, 10), issPos(0, 179)]) {
      feed.emit(state(pos));
      const yes = isAboveHorizon(VISITOR, pos);
      expect(horizon.hidden).toBe(false);
      expect(horizon.textContent).toBe(`Above your horizon: ${yes ? "yes" : "no"}`);
    }
    expect(notice.textContent).toBe("");
  });

  it("shows the answer from a position received before the location arrived", () => {
    const geo = grantingGeolocation();
    const { feed, horizon } = setup({ geolocation: geo });
    feed.emit(state(issPos(51, 0)));
    expect(horizon.hidden).toBe(true);
    geo.pending.grant();
    expect(horizon.textContent).toBe("Above your horizon: yes");
  });

  it("keeps showing the answer for the last known position when out of date, and hides it with no position", () => {
    const geo = grantingGeolocation();
    const { feed, horizon } = setup({ geolocation: geo });
    geo.pending.grant();
    feed.emit(state(issPos(51, 0)));
    feed.emit(state(issPos(51, 0), { outOfDate: true, ageSeconds: 120, error: "x" }));
    expect(horizon.hidden).toBe(false);
    expect(horizon.textContent).toBe("Above your horizon: yes");
    feed.emit(state(null, { outOfDate: true, ageSeconds: null, error: "x" }));
    expect(horizon.hidden).toBe(true);
  });

  it("does not move the view if the map was dragged before the answer, but still adds the marker", () => {
    const geo = grantingGeolocation();
    const { map, addMarker } = setup({ geolocation: geo });
    map.fire("dragstart");
    geo.pending.grant();
    expect(addMarker).toHaveBeenCalledTimes(1);
    expect(map.views).toEqual([]);
  });

  it("does not move the view if tracking is on when the answer arrives, but still adds the marker", () => {
    const geo = grantingGeolocation();
    const { map, addMarker } = setup({ geolocation: geo, tracking: true });
    geo.pending.grant();
    expect(addMarker).toHaveBeenCalledTimes(1);
    expect(map.views).toEqual([]);
  });
});

describe("location refused or unavailable (AC-12)", () => {
  const cases = {
    "permission denied": () => failingGeolocation(1),
    unavailable: () => failingGeolocation(2),
    timeout: () => failingGeolocation(3),
    "no geolocation API": () => undefined,
    "a throwing API": () => ({ getCurrentPosition: () => { throw new Error("boom"); } }),
  };
  const notices = {};
  for (const [name, make] of Object.entries(cases)) {
    it(`${name}: no marker, no view change, horizon hidden, a notice`, () => {
      const { map, addMarker, horizon, notice, feed } = setup({ geolocation: make() });
      feed.emit(state(issPos(51, 0)));
      expect(addMarker).not.toHaveBeenCalled();
      expect(map.views).toEqual([]);
      expect(horizon.hidden).toBe(true);
      expect(notice.textContent.length).toBeGreaterThan(10);
      notices[name] = notice.textContent;
    });
  }

  it("insecure context: no request, a notice", () => {
    const geo = grantingGeolocation();
    const { notice, addMarker } = setup({ geolocation: geo, secure: false });
    expect(geo.calls).toHaveLength(0);
    expect(addMarker).not.toHaveBeenCalled();
    expect(notice.textContent).not.toBe("");
  });

  it("uses different wording for denied, unavailable/timeout, and unsupported", () => {
    expect(notices["permission denied"]).toMatch(/blocked/i);
    expect(notices.unavailable).toBe(notices.timeout);
    const distinct = new Set([notices["permission denied"], notices.unavailable, notices["no geolocation API"]]);
    expect(distinct.size).toBe(3);
  });
});

describe("the location never leaves the browser (AC-13)", () => {
  it("no request made by the feed or the controller carries the latitude or longitude", async () => {
    const requests = [];
    const fetchFn = vi.fn(async (...args) => {
      requests.push(args);
      return { ok: true, status: 200, json: async () => ({ ...issPos(51, 0), outOfDate: false, ageSeconds: 0 }) };
    });
    const feed = createIssFeed({ fetchFn, intervalMs: 10 });
    const geo = grantingGeolocation();
    const map = fakeMap();
    const horizon = { hidden: true, textContent: "" };
    createLocationController({ geolocation: geo, secure: true, map, feed, horizon, notice: { textContent: "" }, addMarker() {}, isTracking: () => false });
    geo.pending.grant();
    feed.start();
    await new Promise((r) => setTimeout(r, 50));
    feed.stop();
    expect(requests.length).toBeGreaterThan(1);
    const text = JSON.stringify(requests);
    expect(text).not.toContain("51.5072");
    expect(text).not.toContain("0.1276");
    expect(horizon.hidden).toBe(false);
  });

  it("location source files never call fetch, XHR, sendBeacon or the console, and use no watchPosition", () => {
    for (const file of ["location.js", "location-controller.js", "geo.js"]) {
      const src = readFileSync(new URL(`../public/js/${file}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
      expect(src, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|new Image|console\.|watchPosition/);
    }
  });
});

describe("page wiring", () => {
  it("index.html has #location-notice as a status in the readout area, and main.js imports location.js", () => {
    const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    expect(html).toMatch(/<p id="location-notice" role="status"><\/p>/);
    expect(html).toMatch(/<p id="readout-horizon" hidden><\/p>/);
    const main = readFileSync(new URL("../public/js/main.js", import.meta.url), "utf8");
    expect(main).toMatch(/import "\.\/location\.js"/);
    const loc = readFileSync(new URL("../public/js/location.js", import.meta.url), "utf8");
    expect(loc).toMatch(/import \{ map \} from "\.\/map\.js"/);
    expect(loc).toMatch(/import \{ feed \} from "\.\/feed\.js"/);
    expect(loc).toContain("You are here");
  });
});
