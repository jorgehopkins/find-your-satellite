import { describe, expect, it } from "vitest";
import { createTrail } from "../public/js/trail.js";

const p = (latitude, longitude, timestamp) => ({ latitude, longitude, timestamp });
const count = (trail) => trail.segments().reduce((n, s) => n + s.length, 0);

describe("createTrail (AC-10)", () => {
  it("starts empty", () => {
    expect(createTrail().segments()).toEqual([]);
  });
  it("covers all points, and a 4th grows it by one", () => {
    const t = createTrail();
    expect(t.add(p(1, 10, 1))).toBe(true);
    expect(t.add(p(2, 20, 2))).toBe(true);
    expect(t.add(p(3, 30, 3))).toBe(true);
    expect(t.segments()).toEqual([[[1, 10], [2, 20], [3, 30]]]);
    t.add(p(4, 40, 4));
    expect(count(t)).toBe(4);
  });
  it("does not add a repeated timestamp", () => {
    const t = createTrail();
    expect(t.add(p(1, 10, 1))).toBe(true);
    expect(t.add(p(5, 50, 1))).toBe(false);
    expect(count(t)).toBe(1);
  });
  it("never joins consecutive points more than 180° apart, either direction", () => {
    for (const [a, b] of [[179, -179], [-179, 179]]) {
      const t = createTrail();
      t.add(p(0, a, 1));
      t.add(p(10, b, 2));
      t.add(p(20, b + Math.sign(b) * 1 * -1, 3));
      const segs = t.segments();
      expect(segs.length).toBe(2);
      for (const s of segs) {
        for (let i = 1; i < s.length; i++) expect(Math.abs(s[i][1] - s[i - 1][1])).toBeLessThanOrEqual(180);
      }
      // the pieces reach the edge at the interpolated latitude
      expect(Math.abs(segs[0].at(-1)[1])).toBe(180);
      expect(Math.abs(segs[1][0][1])).toBe(180);
      expect(segs[0].at(-1)[0]).toBeCloseTo(5);
      expect(segs[1][0][0]).toBeCloseTo(5);
    }
  });
  it("keeps only the most recent 2000 points", () => {
    const t = createTrail();
    for (let i = 1; i <= 2005; i++) t.add(p(0, (i % 100) - 50, i));
    expect(count(t)).toBe(2000);
    expect(t.add(p(0, 0, 2005))).toBe(false);
  });
});
