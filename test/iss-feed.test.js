import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIssFeed } from "../public/js/iss-feed.js";

const body = (over = {}) => ({ latitude: 12.3, longitude: -45.6, altitudeKm: 420.1, speedKmh: 27580.2, timestamp: 1760000000, outOfDate: false, ageSeconds: 0, ...over });
const ok = (b) => ({ ok: true, status: 200, json: async () => b });
const status = (code) => ({ ok: false, status: code, json: async () => ({ error: "x" }) });

let calls;
let responses; // queue of () => Promise<response> | response
const fetchFn = vi.fn(async (url) => {
  calls.push(url);
  const next = responses.length > 1 ? responses.shift() : responses[0];
  return next();
});

const tick = (ms) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  responses = [() => ok(body())];
  fetchFn.mockClear();
});
afterEach(() => vi.useRealTimers());

function setup(extra = {}) {
  const feed = createIssFeed({ fetchFn, ...extra });
  const seen = [];
  feed.subscribe((s) => seen.push(s));
  return { feed, seen };
}

describe("iss feed polling (AC-8)", () => {
  it("requests /api/iss immediately, then every 5 seconds, and reports each success", async () => {
    const { feed, seen } = setup();
    feed.start();
    await tick(0);
    expect(calls).toEqual(["/api/iss"]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      position: { latitude: 12.3, longitude: -45.6, altitudeKm: 420.1, speedKmh: 27580.2, timestamp: 1760000000 },
      outOfDate: false,
      ageSeconds: 0,
      error: null,
    });
    await tick(4999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    await tick(5000);
    expect(calls).toHaveLength(3);
    expect(seen).toHaveLength(3);
    feed.stop();
    await tick(20000);
    expect(calls).toHaveLength(3);
  });

  it("honours intervalMs", async () => {
    const { feed } = setup({ intervalMs: 1000 });
    feed.start();
    await tick(3000);
    expect(calls).toHaveLength(4);
    feed.stop();
  });

  it("start twice does not double the polling", async () => {
    const { feed } = setup();
    feed.start();
    feed.start();
    await tick(5000);
    expect(calls).toHaveLength(2);
    feed.stop();
  });
});

describe("out of date and failures (AC-6)", () => {
  it("passes through outOfDate:true with the server's age", async () => {
    responses = [() => ok(body({ outOfDate: true, ageSeconds: 120 }))];
    const { feed, seen } = setup();
    feed.start();
    await tick(0);
    expect(seen[0].outOfDate).toBe(true);
    expect(seen[0].ageSeconds).toBe(120);
    expect(seen[0].position.latitude).toBe(12.3);
    expect(seen[0].error).toBeNull();
    feed.stop();
  });

  it("after a failure keeps the last position, marks it out of date and grows the age; keeps polling; fresh data recovers", async () => {
    responses = [() => ok(body({ latitude: 1 })), () => { throw new TypeError("network down"); }, () => status(503), () => ok(body({ latitude: 2 }))];
    const { feed, seen } = setup();
    feed.start();
    await tick(0);
    await tick(5000);
    expect(seen[1].position.latitude).toBe(1);
    expect(seen[1].outOfDate).toBe(true);
    expect(seen[1].ageSeconds).toBe(5);
    expect(seen[1].error).toEqual(expect.any(String));
    expect(seen[1].error.length).toBeGreaterThan(0);
    await tick(5000);
    expect(seen[2].outOfDate).toBe(true);
    expect(seen[2].ageSeconds).toBe(10);
    expect(seen[2].position.latitude).toBe(1);
    await tick(5000);
    expect(seen[3]).toMatchObject({ outOfDate: false, ageSeconds: 0, error: null, position: { latitude: 2 } });
    feed.stop();
  });

  it("adds the server-reported age to the locally elapsed time", async () => {
    responses = [() => ok(body({ outOfDate: true, ageSeconds: 100 })), () => status(500)];
    const { feed, seen } = setup();
    feed.start();
    await tick(5000);
    expect(seen[1].ageSeconds).toBe(105);
    feed.stop();
  });

  it("treats bad JSON as a failure", async () => {
    responses = [() => ok(body()), () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }), () => ok({ nonsense: true })];
    const { feed, seen } = setup();
    feed.start();
    await tick(10000);
    expect(seen[1]).toMatchObject({ outOfDate: true, position: { latitude: 12.3 } });
    expect(seen[1].error).toBeTruthy();
    expect(seen[2]).toMatchObject({ outOfDate: true, position: { latitude: 12.3 } });
    feed.stop();
  });
});

describe("never received (AC-7)", () => {
  it("503 on the first request gives position null, and polling goes on", async () => {
    responses = [() => status(503), () => ok(body())];
    const { feed, seen } = setup();
    feed.start();
    await tick(0);
    expect(seen[0]).toEqual({ position: null, outOfDate: true, ageSeconds: null, error: expect.any(String) });
    await tick(5000);
    expect(seen[1].position.latitude).toBe(12.3);
    feed.stop();
  });
});

describe("robustness", () => {
  it("never overlaps two requests", async () => {
    let release;
    responses = [() => new Promise((r) => { release = () => r(ok(body())); })];
    const { feed, seen } = setup();
    feed.start();
    await tick(20000);
    expect(calls).toHaveLength(1);
    release();
    await tick(0);
    expect(seen).toHaveLength(1);
    await tick(5000);
    expect(calls).toHaveLength(2);
    feed.stop();
  });

  it("gives each subscriber its own copy, and one throwing subscriber harms nothing", async () => {
    const feed = createIssFeed({ fetchFn });
    const got = [];
    feed.subscribe(() => { throw new Error("boom"); });
    feed.subscribe((s) => { s.position.latitude = 999; got.push(s); });
    feed.subscribe((s) => got.push(s));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    feed.start();
    await tick(5000);
    expect(calls).toHaveLength(2);
    expect(got).toHaveLength(4);
    expect(got[1].position.latitude).toBe(12.3);
    expect(got[0]).not.toBe(got[1]);
    errors.mockRestore();
    feed.stop();
  });

  it("subscribe returns an unsubscribe function", async () => {
    const feed = createIssFeed({ fetchFn });
    const fn = vi.fn();
    const off = feed.subscribe(fn);
    off();
    feed.start();
    await tick(0);
    expect(fn).not.toHaveBeenCalled();
    feed.stop();
  });
});
