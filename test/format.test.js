import { describe, expect, it } from "vitest";
import { formatAge, noticeText, readoutText } from "../public/js/format.js";

describe("formatAge", () => {
  it("phrases seconds, minutes and hours", () => {
    expect(formatAge(30)).toBe("30 s");
    expect(formatAge(120)).toBe("2 min");
    expect(formatAge(3600)).toBe("1 h");
    expect(formatAge(0)).toBe("0 s");
    expect(formatAge(59.9)).toBe("59 s");
    expect(formatAge(90)).toBe("1 min");
    expect(formatAge(7200 + 1800)).toBe("2 h");
    expect(formatAge(-5)).toBe("0 s");
    expect(formatAge(NaN)).toBe("0 s");
  });
});

const pos = { latitude: 12.345, longitude: -45.678, altitudeKm: 420.14, speedKmh: 27580.2, timestamp: 1 };

describe("noticeText (AC-6, AC-7)", () => {
  it("is empty when fresh", () => {
    expect(noticeText({ position: pos, outOfDate: false, ageSeconds: 0, error: null }, 0)).toBe("");
  });
  it("says how old an out-of-date position is, growing with elapsed time", () => {
    const s = { position: pos, outOfDate: true, ageSeconds: 100, error: "x" };
    expect(noticeText(s, 0)).toBe("Out of date: last updated 1 min ago");
    expect(noticeText(s, 20)).toBe("Out of date: last updated 2 min ago");
  });
  it("says no position has been received when there never was one", () => {
    expect(noticeText({ position: null, outOfDate: true, ageSeconds: null, error: "x" }, 3)).toBe("No ISS position has been received yet");
  });
});

describe("readoutText (AC-8)", () => {
  it("rounds sensibly", () => {
    expect(readoutText(pos)).toEqual({ latitude: "12.35°", longitude: "-45.68°", altitude: "420.1 km", speed: "27,580 km/h" });
  });
  it("shows dashes without a position", () => {
    expect(readoutText(null)).toEqual({ latitude: "–", longitude: "–", altitude: "–", speed: "–" });
  });
});
