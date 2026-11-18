import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handle } from "../src/app.js";
import { createApp } from "../src/http.js";

let server;
let base;
beforeAll(async () => {
  server = createApp({ log: () => {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

// Sends the path exactly as written, without the client tidying up "..".
const raw = (path) =>
  new Promise((resolve, reject) => {
    import("node:http").then(({ request }) => {
      const req = request({ host: "127.0.0.1", port: server.address().port, path, method: "GET" }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.end();
    });
  });

describe("the portal page", () => {
  it("AC-1: serves the map, readout and track button, and no Hello", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    const html = await res.text();
    expect(html).toContain('id="map"');
    expect(html).toContain('<section id="readout"');
    for (const id of ["readout-latitude", "readout-longitude", "readout-altitude", "readout-speed"]) expect(html).toContain(`<dd id="${id}"`);
    expect(html).toContain('<p id="readout-horizon" hidden>');
    expect(html).toContain('<p id="notice" role="status">');
    expect(html).toMatch(/<button id="track-button" type="button" disabled>Track ISS<\/button>/);
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain("Hello");
  });

  it("AC-2: loads only relative scripts and styles, which our server serves", async () => {
    const html = await (await fetch(`${base}/`)).text();
    const urls = [...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g), ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(urls).toEqual(expect.arrayContaining(["/assets/js/main.js", "/vendor/leaflet/leaflet.js", "/vendor/leaflet/leaflet.css", "/assets/css/style.css"]));
    for (const url of urls) {
      expect(url).not.toMatch(/^(http|\/\/)/);
      expect((await fetch(base + url)).status).toBe(200);
    }
    const js = await fetch(`${base}/vendor/leaflet/leaflet.js`);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    const css = await fetch(`${base}/vendor/leaflet/leaflet.css`);
    expect(css.headers.get("content-type")).toMatch(/^text\/css/);
    const png = await fetch(`${base}/vendor/leaflet/images/marker-icon.png`);
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect((await fetch(`${base}/assets/js/map.js`)).headers.get("content-type")).toMatch(/javascript/);
  });

  it("sends a Content-Security-Policy limiting scripts and images", async () => {
    const csp = (await fetch(`${base}/`)).headers.get("content-security-policy");
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).toContain("img-src 'self' data: https://*.tile.openstreetmap.org");
  });

  it("has a Cache-Control that is safe in development", async () => {
    expect((await fetch(`${base}/assets/js/map.js`)).headers.get("cache-control")).toMatch(/no-cache|no-store|max-age=0/);
  });

  it("AC-3 and AC-14: the map has the OpenStreetMap credit and keeps every interaction on", () => {
    const source = readFileSync(new URL("../public/js/map.js", import.meta.url), "utf8");
    expect(source).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(source).toContain("maxZoom: 19");
    expect(source).toMatch(/attribution:[^\n]*href="https:\/\/www\.openstreetmap\.org\/copyright"[^\n]*OpenStreetMap/);
    expect(source).toContain("export const map");
    expect(source).not.toMatch(/dragging:\s*false|scrollWheelZoom:\s*false|touchZoom:\s*false|zoomControl:\s*false|\.(dragging|scrollWheelZoom|touchZoom|doubleClickZoom)\.disable/);
    const main = readFileSync(new URL("../public/js/main.js", import.meta.url), "utf8");
    expect(main).toMatch(/import (\{ map \} from )?"\.\/map\.js"/);
  });
});

describe("static files", () => {
  it.each(["/assets/../package.json", "/assets/%2e%2e/package.json", "/vendor/leaflet/../../package.json", "/assets/%2E%2E/package.json", "/assets/..%2fpackage.json", "/assets/%2fetc/passwd", "/assets//etc/passwd", "/assets/js/%00"])(
    "answers 404 for %s",
    async (path) => {
      expect(await raw(path)).toBe(404);
    },
  );

  it("answers 404 for a missing asset and for a directory", async () => {
    expect((await fetch(`${base}/assets/js/nothing.js`)).status).toBe(404);
    expect((await fetch(`${base}/assets/js`)).status).toBe(404);
    expect((await fetch(`${base}/vendor/leaflet/nothing.js`)).status).toBe(404);
  });
});

describe("the app", () => {
  it("answers its health check", async () => {
    expect(JSON.parse((await handle({ method: "GET", url: "/health" })).body)).toEqual({ status: "ok" });
  });

  it("says when there's nothing at an address", async () => {
    expect((await handle({ method: "GET", url: "/nowhere" })).status).toBe(404);
  });

  it("answers 404 for /api/* addresses nothing handles, not a file", async () => {
    expect((await handle({ method: "GET", url: "/api/nothing" })).status).toBe(404);
  });

  it("ignores the query string when routing", async () => {
    expect((await handle({ method: "GET", url: "/health?x=1" })).status).toBe(200);
  });
});
