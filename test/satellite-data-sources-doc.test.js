import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync(new URL("../docs/satellite-data-sources.md", import.meta.url), "utf8");

// The text of one source's section: from its "## " or "### " heading to the next one.
function section(heading) {
  const parts = doc.split(/^#{2,3} /m).slice(1);
  const found = parts.find((p) => p.split("\n")[0].toLowerCase().includes(heading.toLowerCase()));
  expect(found, `section "${heading}" exists`).toBeDefined();
  return found;
}

describe("docs/satellite-data-sources.md", () => {
  it("mentions the named sources and satellites", () => {
    for (const term of ["CelesTrak", "N2YO", "Space-Track", "Starlink", "weather satellites", "wheretheiss.at", "OpenStreetMap"]) {
      expect(doc, term).toContain(term);
    }
  });

  it.each(["CelesTrak", "N2YO", "Space-Track"])("%s has access requirements, rate limits and trade-offs", (name) => {
    const text = section(name).toLowerCase();
    for (const part of ["access requirements", "rate limits", "trade-offs"]) {
      expect(text, `${name}: ${part}`).toContain(part);
    }
  });

  it("names the later ideas", () => {
    const text = doc.toLowerCase();
    expect(text).toContain("horizon");
    expect(text).toContain("circle");
    expect(text).toContain("predicted future paths");
    expect(text).toContain("3d globe");
  });

  it("notes that a hosted tile provider is needed if traffic outgrows OpenStreetMap's rules", () => {
    expect(doc).toMatch(/hosted tile provider/i);
    expect(doc).toMatch(/tile usage (rules|policy)|acceptable-use/i);
  });
});
