// The ISS Position: fetched from wheretheiss.at, cached for a few seconds and shared between visitors.
import { stdoutLog } from "./log.js";
import { withSpan } from "./tracing.js";

const UPSTREAM_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const CACHE_MS = 3000; // how long the latest position is reused
const MIN_INTERVAL_MS = 1000; // upstream allows about 1 request per second
const TIMEOUT_MS = 5000;

const JSON_TYPE = "application/json";
const NUMERIC_FIELDS = ["latitude", "longitude", "altitude", "velocity", "timestamp"];

/** An upstream answer we can't use; `status` is the HTTP status when there was one. */
class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** Calls the data service once and returns the validated Position (with the upstream's Unix time). */
async function fetchPosition(fetchFn) {
  return withSpan("wheretheiss.at fetch", { "http.request.method": "GET", "url.full": UPSTREAM_URL }, async (span) => {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new UpstreamError(`timed out after ${TIMEOUT_MS} ms`));
      }, TIMEOUT_MS);
    });
    try {
      const response = await Promise.race([fetchFn(UPSTREAM_URL, { signal: controller.signal }), timeout]);
      span.setAttribute("http.response.status_code", response.status);
      if (!response.ok) throw new UpstreamError(`upstream status ${response.status}`, response.status);
      const data = await Promise.race([response.json(), timeout]);
      for (const field of NUMERIC_FIELDS) {
        if (typeof data?.[field] !== "number" || !Number.isFinite(data[field])) throw new UpstreamError(`upstream body has no numeric ${field}`, response.status);
      }
      return { latitude: data.latitude, longitude: data.longitude, altitudeKm: data.altitude, speedKmh: data.velocity, timestamp: data.timestamp };
    } finally {
      clearTimeout(timer);
      timeout.catch(() => {}); // a timeout that lost the race is not an unhandled rejection
    }
  });
}

/**
 * Creates the ISS Position service. `fetch`, `now` (ms) and `log` can be replaced, e.g. by tests.
 * `getPosition()` returns an app answer: `{ status, type, body }`.
 */
export function createIss({ fetch: fetchFn = globalThis.fetch, now = Date.now, log = stdoutLog } = {}) {
  let last; // { position, receivedAt }
  let lastAttemptAt; // when upstream was last called, or last failed
  let inFlight;

  const ok = (outOfDate) => {
    const age = Math.max(0, Math.floor((now() - last.receivedAt) / 1000));
    return { status: 200, type: JSON_TYPE, body: JSON.stringify({ ...last.position, outOfDate, ageSeconds: age }) };
  };
  const unavailable = () => ({ status: 503, type: JSON_TYPE, body: JSON.stringify({ error: "ISS position unavailable" }) });

  async function refresh() {
    lastAttemptAt = now();
    try {
      last = { position: await fetchPosition(fetchFn), receivedAt: now() };
      lastAttemptAt = last.receivedAt;
      return ok(false);
    } catch (error) {
      lastAttemptAt = now();
      log({
        level: "error",
        msg: "ISS upstream failed",
        cause: error?.status === undefined ? (error?.message ?? String(error)) : `status ${error.status}: ${error.message}`,
        upstreamStatus: error?.status,
        servedLastPosition: last !== undefined,
      });
      return last ? ok(true) : unavailable();
    }
  }

  async function getPosition() {
    if (last && now() - last.receivedAt < CACHE_MS) return ok(false);
    if (inFlight) return inFlight;
    // Don't call upstream again within a second of the last call, even if it failed.
    if (lastAttemptAt !== undefined && now() - lastAttemptAt < MIN_INTERVAL_MS) return last ? ok(true) : unavailable();
    inFlight = refresh().finally(() => { inFlight = undefined; });
    return inFlight;
  }

  return { getPosition };
}
