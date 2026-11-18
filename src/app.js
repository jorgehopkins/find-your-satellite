// What the app answers, apart from how it's served, so tests can call it directly.
import { fileURLToPath } from "node:url";
import { serveStatic } from "./static.js";
import { withSpan } from "./tracing.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const LEAFLET_DIR = fileURLToPath(new URL("../node_modules/leaflet/dist", import.meta.url));

// Scripts only from us; the only pictures from elsewhere are OpenStreetMap's map tiles.
const PAGE_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

/**
 * Every request's answer: `{ status, type, body, headers? }`.
 * `body` is a string or a Buffer; `headers` is an optional object of extra response headers.
 */
export async function handle({ method, url }) {
  const path = new URL(url, "http://localhost").pathname;
  if (method === "GET" && path === "/health") return { status: 200, type: "application/json", body: JSON.stringify({ status: "ok" }) };
  if (method === "GET" && path === "/") {
    const page = await withSpan("static /", { "file.path": "index.html" }, () => serveStatic(PUBLIC_DIR, "index.html"));
    return page.status === 200 ? { ...page, headers: { ...page.headers, "content-security-policy": PAGE_CSP } } : page;
  }
  if (method === "GET" && path.startsWith("/vendor/leaflet/")) {
    return withSpan("static /vendor/leaflet", {}, () => serveStatic(`${LEAFLET_DIR}`, path.slice("/vendor/leaflet/".length)));
  }
  if (method === "GET" && path.startsWith("/assets/")) {
    return withSpan("static /assets", {}, () => serveStatic(PUBLIC_DIR, path.slice("/assets/".length)));
  }
  return { status: 404, type: "application/json", body: JSON.stringify({ error: "Not found" }) };
}
