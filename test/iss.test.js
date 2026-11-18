import { trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHandle } from "../src/app.js";
import { createIss } from "../src/iss.js";
import { createApp } from "../src/http.js";

const exporter = new InMemorySpanExporter();
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }));

const sample = { latitude: 12.3, longitude: -45.6, altitude: 420.1, velocity: 27580.2, timestamp: 1760000000, visibility: "daylight" };
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A fake upstream: `script` is a list of responders, the last one repeating. Counts calls. */
function fakeUpstream(...script) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    return step();
  };
  return { fetch, calls };
}

let clock;
let logs;
let upstream;
let base;
let server;
async function start(...script) {
  clock = 1_000_000;
  logs = [];
  upstream = fakeUpstream(...script);
  const iss = createIss({ fetch: upstream.fetch, now: () => clock, log: (f) => logs.push(f) });
  server = createApp({ handle: createHandle({ iss }), log: (f) => logs.push(f) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
const get = async (path = "/api/iss") => {
  const response = await fetch(base + path);
  return { response, text: await response.text() };
};
const ok = () => json(sample);
const failures = {
  error: () => { throw new Error("connect ECONNREFUSED 10.0.0.1:443"); },
  status: () => json({ message: "boom upstream text" }, 500),
  malformed: () => json({ latitude: "north", longitude: 1 }),
};

beforeEach(() => exporter.reset());
afterEach(() => new Promise((resolve) => server.close(resolve)));

describe("GET /api/iss", () => {
  it("AC-4: returns the upstream position in our shape", async () => {
    await start(ok);
    const { response, text } = await get("/api/iss?x=1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(text)).toEqual({ latitude: 12.3, longitude: -45.6, altitudeKm: 420.1, speedKmh: 27580.2, timestamp: 1760000000, outOfDate: false, ageSeconds: 0 });
    expect(upstream.calls[0].url).toBe("https://api.wheretheiss.at/v1/satellites/25544");
  });

  it("AC-5: shares one call between concurrent requests and within the window, then calls again", async () => {
    await start(ok);
    const [a, b] = await Promise.all([get(), get()]);
    expect(a.response.status).toBe(200);
    expect(b.text).toBe(a.text);
    expect(upstream.calls).toHaveLength(1);
    clock += 2999;
    const cached = JSON.parse((await get()).text);
    expect(upstream.calls).toHaveLength(1);
    expect(cached).toMatchObject({ outOfDate: false, ageSeconds: 2 });
    clock += 1;
    await get();
    expect(upstream.calls).toHaveLength(2);
  });

  it("shares one in-flight call that is still pending", async () => {
    let release;
    await start(() => new Promise((resolve) => { release = () => resolve(json(sample)); }));
    const first = get();
    const second = get();
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    expect((await first).response.status).toBe(200);
    expect((await second).response.status).toBe(200);
    expect(upstream.calls).toHaveLength(1);
  });

  it("never calls upstream twice within one second, even when every call fails", async () => {
    await start(failures.error);
    expect((await get()).response.status).toBe(503);
    clock += 999;
    expect((await get()).response.status).toBe(503);
    expect(upstream.calls).toHaveLength(1);
    clock += 1;
    await get();
    expect(upstream.calls).toHaveLength(2);
  });

  it("doesn't retry within a second of a failure when a last position exists", async () => {
    await start(ok, failures.error);
    await get();
    clock += 3000;
    const first = JSON.parse((await get()).text);
    clock += 500;
    const second = JSON.parse((await get()).text);
    expect(upstream.calls).toHaveLength(2);
    expect(first).toMatchObject({ outOfDate: true, ageSeconds: 3 });
    expect(second).toMatchObject({ outOfDate: true, ageSeconds: 3 });
  });

  for (const [name, failure] of Object.entries(failures)) {
    it(`AC-6: serves the last position as out of date when upstream fails (${name})`, async () => {
      await start(ok, failure);
      await get();
      clock += 7500;
      const { response, text } = await get();
      expect(response.status).toBe(200);
      expect(JSON.parse(text)).toEqual({ latitude: 12.3, longitude: -45.6, altitudeKm: 420.1, speedKmh: 27580.2, timestamp: 1760000000, outOfDate: true, ageSeconds: 7 });
      expect(logs.find((l) => l.msg === "ISS upstream failed")).toMatchObject({ level: "error", servedLastPosition: true });
    });

    it(`AC-7: answers 503 with no detail when nothing was ever fetched (${name})`, async () => {
      await start(failure);
      const { response, text } = await get();
      expect(response.status).toBe(503);
      expect(JSON.parse(text)).toEqual({ error: "ISS position unavailable" });
      expect(text).not.toMatch(/ECONNREFUSED|boom|stack|\bat /);
      const failed = logs.find((l) => l.msg === "ISS upstream failed");
      expect(failed).toMatchObject({ level: "error", servedLastPosition: false });
      expect(failed.cause).toEqual(expect.any(String));
    });
  }

  it("logs the status code as the cause of a non-2xx answer", async () => {
    await start(failures.status);
    await get();
    expect(logs.find((l) => l.msg === "ISS upstream failed").cause).toContain("500");
  });

  it("T12: logs the underlying cause (name, message, code) of a failed fetch, and keeps it from clients", async () => {
    const failFetch = () => {
      const cause = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:443"), { code: "ECONNREFUSED" });
      throw new TypeError("fetch failed", { cause });
    };
    await start(failFetch);
    const { response, text } = await get();
    expect(response.status).toBe(503);
    expect(text).toBe(JSON.stringify({ error: "ISS position unavailable" }));
    expect(text).not.toMatch(/ECONNREFUSED|cause|stack/);
    const failed = logs.find((l) => l.msg === "ISS upstream failed");
    expect(failed.cause).toBe("fetch failed");
    expect(failed.underlyingCause).toEqual({ name: "Error", message: "connect ECONNREFUSED 10.0.0.1:443", code: "ECONNREFUSED" });
    expect(JSON.stringify(failed)).toContain("ECONNREFUSED");
  });

  it("T12: copes with a cause that is not an Error", async () => {
    await start(() => { throw new TypeError("fetch failed", { cause: "plain text reason" }); });
    await get();
    expect(logs.find((l) => l.msg === "ISS upstream failed").underlyingCause).toEqual({ message: "plain text reason" });
  });

  it("gives up on an upstream that doesn't answer, and tells the fetch to abort", async () => {
    await start(() => new Promise(() => {}));
    const { response } = await get();
    expect(response.status).toBe(503);
    expect(upstream.calls[0].options.signal.aborted).toBe(true);
    expect(logs.find((l) => l.msg === "ISS upstream failed").cause).toMatch(/timed out/);
  }, 10000);

  it("AC-20: traces the upstream call and logs the request", async () => {
    await start(ok);
    await get();
    const span = exporter.getFinishedSpans().find((s) => s.name === "wheretheiss.at fetch");
    expect(span.attributes["http.response.status_code"]).toBe(200);
    expect(exporter.getFinishedSpans().some((s) => s.name === "GET /api/iss")).toBe(true);
    expect(logs.find((l) => l.msg === "request")).toMatchObject({ method: "GET", route: "/api/iss", status: 200 });
    expect(typeof logs.find((l) => l.msg === "request").durationMs).toBe("number");
  });

  it("AC-20: records the upstream status on a failed call's span", async () => {
    await start(failures.status);
    await get();
    const span = exporter.getFinishedSpans().find((s) => s.name === "wheretheiss.at fetch");
    expect(span.attributes["http.response.status_code"]).toBe(500);
  });
});
