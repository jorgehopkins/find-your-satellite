import { describe, expect, it } from "vitest";
import { isAboveHorizon } from "../public/js/geo.js";

const iss = (latitude, longitude, altitudeKm = 420) => ({ latitude, longitude, altitudeKm });
const KM_PER_DEG = (2 * Math.PI * 6371) / 360; // ~111.19 km

describe("isAboveHorizon (AC-11)", () => {
  it("is true directly under the ISS", () => {
    expect(isAboveHorizon({ latitude: 10, longitude: 20 }, iss(10, 20))).toBe(true);
  });

  it("is true at 2000 km and false at 3000 km, for 420 km altitude", () => {
    const at = (km) => ({ latitude: 0, longitude: km / KM_PER_DEG });
    expect(isAboveHorizon(at(2000), iss(0, 0))).toBe(true);
    expect(isAboveHorizon(at(2200), iss(0, 0))).toBe(true);
    expect(isAboveHorizon(at(2300), iss(0, 0))).toBe(false);
    expect(isAboveHorizon(at(3000), iss(0, 0))).toBe(false);
  });

  it("is false at the antipode", () => {
    expect(isAboveHorizon({ latitude: -30, longitude: -160 }, iss(30, 20))).toBe(false);
  });

  it("works across the ±180° line", () => {
    expect(isAboveHorizon({ latitude: 40, longitude: 179 }, iss(40, -179))).toBe(true);
    expect(isAboveHorizon({ latitude: 0, longitude: 170 }, iss(0, -170))).toBe(true);
    expect(isAboveHorizon({ latitude: 0, longitude: 160 }, iss(0, -160))).toBe(false);
  });

  it("works over the poles", () => {
    expect(isAboveHorizon({ latitude: 89, longitude: 0 }, iss(89, 180))).toBe(true);
    expect(isAboveHorizon({ latitude: 60, longitude: 0 }, iss(60, 180))).toBe(false);
  });

  it("sees further from higher up", () => {
    const visitor = { latitude: 0, longitude: 3000 / KM_PER_DEG };
    expect(isAboveHorizon(visitor, iss(0, 0, 420))).toBe(false);
    expect(isAboveHorizon(visitor, iss(0, 0, 1500))).toBe(true);
  });
});
