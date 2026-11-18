import { describe, expect, it } from "vitest";
import { interpolatePosition } from "../public/js/animate.js";

const from = { latitude: 10, longitude: 20 };
const to = { latitude: 20, longitude: 40 };

describe("interpolatePosition (AC-9)", () => {
  it("is strictly between old and new during the interval and never jumps", () => {
    let prev = interpolatePosition(from, to, 0, 5000);
    expect(prev).toEqual(from);
    for (let ms = 100; ms < 5000; ms += 100) {
      const p = interpolatePosition(from, to, ms, 5000);
      expect(p.latitude).toBeGreaterThan(10);
      expect(p.latitude).toBeLessThan(20);
      expect(p.longitude).toBeGreaterThan(20);
      expect(p.longitude).toBeLessThan(40);
      expect(p.latitude - prev.latitude).toBeLessThan(0.25);
      prev = p;
    }
  });
  it("ends exactly at the new position, and stays there", () => {
    expect(interpolatePosition(from, to, 5000, 5000)).toEqual(to);
    expect(interpolatePosition(from, to, 9000, 5000)).toEqual(to);
  });
  it("goes the short way round across the ±180° line", () => {
    const a = { latitude: 0, longitude: 179 };
    const b = { latitude: 0, longitude: -179 };
    const mid = interpolatePosition(a, b, 2500, 5000);
    expect(Math.abs(mid.longitude)).toBe(180);
    const early = interpolatePosition(a, b, 1000, 5000);
    expect(early.longitude).toBeGreaterThan(179);
    expect(early.longitude).toBeLessThanOrEqual(180);
    const late = interpolatePosition(a, b, 4000, 5000);
    expect(late.longitude).toBeLessThan(-179);
    expect(late.longitude).toBeGreaterThanOrEqual(-180);
    // And the other direction.
    const back = interpolatePosition(b, a, 1000, 5000);
    expect(back.longitude).toBeLessThan(-179);
  });
  it("handles a zero duration", () => {
    expect(interpolatePosition(from, to, 0, 0)).toEqual(to);
  });
});
