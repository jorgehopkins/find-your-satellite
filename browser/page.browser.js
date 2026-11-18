// Loads "/" in headless Chromium with the real CSP header and a stubbed data service.
// Run with `npm run test:browser` (needs Chromium; see README).
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { createHandle } from "../src/app.js";
import { createApp } from "../src/http.js";
import { createIss } from "../src/iss.js";

// A 1x1 transparent PNG, standing in for an OpenStreetMap tile.
const TILE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let release; // lets the stubbed data service answer
const gate = new Promise((resolve) => { release = resolve; });
const stubFetch = async () => {
  await gate;
  return new Response(JSON.stringify({ latitude: 10, longitude: 20, altitude: 420.5, velocity: 27600, timestamp: 1_700_000_000 }), { headers: { "content-type": "application/json" } });
};

let server, baseUrl, browser, context, page;
const consoleErrors = [];
const pageErrors = [];
const tileRequests = [];

beforeAll(async () => {
  const handle = createHandle({ iss: createIss({ fetch: stubFetch, log: () => {} }) });
  server = createApp({ handle, log: () => {} });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  context = await browser.newContext({ viewport: { width: 1000, height: 700 }, permissions: ["geolocation"], geolocation: { latitude: 51.5, longitude: -0.1 } });
  // No network beyond our own server: tiles are answered here.
  await context.route("https://*.openstreetmap.org/**", (route) => {
    tileRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: TILE_PNG });
  });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/`);
}, 60_000);

afterAll(async () => {
  release?.();
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
});

describe("the page in a real browser", () => {
  it("disables Track ISS until the first position has arrived", async () => {
    const button = page.locator("#track-button");
    await expect(button.isDisabled()).resolves.toBe(true);
    await expect(button.textContent()).resolves.toBe("Track ISS");
    release();
    await page.waitForSelector("#track-button:not([disabled])", { timeout: 15_000 });
  });

  it("shows a sized ISS marker and a filled readout", async () => {
    await page.waitForSelector(".iss-icon", { state: "visible", timeout: 15_000 });
    const box = await page.locator(".iss-icon").boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    for (const id of ["latitude", "longitude", "altitude", "speed"]) {
      expect((await page.locator(`#readout-${id}`).textContent()).trim(), id).not.toBe("");
    }
  });

  it("renders map tiles", async () => {
    await page.waitForFunction(() => [...document.querySelectorAll("img.leaflet-tile")].some((img) => img.complete && img.naturalWidth > 0), null, { timeout: 15_000 });
    expect(tileRequests.length).toBeGreaterThan(0);
  });

  it("reads 'Tracking ISS' after a click and 'Track ISS' after another", async () => {
    const button = page.locator("#track-button");
    await button.click();
    await expect(button.textContent()).resolves.toBe("Tracking ISS");
    await button.click();
    await expect(button.textContent()).resolves.toBe("Track ISS");
  });

  it("reports no CSP violation, console error or uncaught error", async () => {
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
