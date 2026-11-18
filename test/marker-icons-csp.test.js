import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../public/css/style.css");

// Pulls the `html:` string out of every L.divIcon({...}) call in a script.
const divIconHtml = (src) => [...src.matchAll(/L\.divIcon\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);

describe("marker icons under a strict CSP (style-src 'self')", () => {
  const scripts = { "main.js": read("../public/js/main.js"), "location.js": read("../public/js/location.js") };

  for (const [name, src] of Object.entries(scripts)) {
    it(`no divIcon html in ${name} uses an inline style attribute`, () => {
      const icons = divIconHtml(src);
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) expect(icon).not.toMatch(/style\s*=/i);
    });
  }

  it("the marker looks come from classes in style.css", () => {
    expect(scripts["main.js"]).toMatch(/iss-marker/);
    expect(scripts["location.js"]).toMatch(/you-marker/);
    expect(css).toMatch(/\.iss-marker\s*\{[^}]*width:\s*22px[^}]*height:\s*22px/);
    expect(css).toMatch(/\.you-marker\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
  });

  it("no page script writes a style attribute or inline-style markup", () => {
    for (const f of ["main.js", "location.js", "map.js", "tracker.js", "trail-layer.js", "feed.js", "iss-feed.js", "location-controller.js"]) {
      expect(read(`../public/js/${f}`), f).not.toMatch(/style\s*=\s*["']|setAttribute\(\s*["']style/);
    }
    expect(read("../public/index.html")).not.toMatch(/\sstyle\s*=|<style|\son\w+\s*=/i);
  });
});
