import { trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/http.js";

const exporter = new InMemorySpanExporter();
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }));

let server;
let logs;
async function start(options = {}) {
  logs = [];
  server = createApp({ log: (fields) => logs.push(fields), ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

beforeEach(() => exporter.reset());
afterEach(() => new Promise((resolve) => server.close(resolve)));

describe("the server", () => {
  it("traces a request as a server span with method, route and status", async () => {
    const base = await start();
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/nowhere`)).status).toBe(404);
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ name: "GET /health", kind: SpanKind.SERVER });
    expect(spans[0].attributes).toMatchObject({ "http.request.method": "GET", "http.route": "/health", "http.response.status_code": 200 });
    expect(spans[1].name).toBe("GET /nowhere");
    expect(spans[1].attributes).toMatchObject({ "http.route": "/nowhere", "http.response.status_code": 404 });
  });

  it("logs one JSON line per request, with the route minus its query string", async () => {
    const base = await start();
    const response = await fetch(`${base}/health?secret=1`);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ method: "GET", route: "/health", status: 200 });
    expect(typeof logs[0].durationMs).toBe("number");
  });

  it("writes real JSON lines to stdout by default", async () => {
    const writes = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => { writes.push(String(chunk)); return true; };
    try {
      const base = await start({ log: undefined });
      await fetch(`${base}/health?q=1`);
    } finally {
      process.stdout.write = original;
    }
    const lines = writes.join("").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: "GET", route: "/health", status: 200 });
    expect(typeof lines[0].durationMs).toBe("number");
  });

  it("answers 500 without a stack trace when a handler throws, and logs the cause", async () => {
    const handle = async () => { throw new Error("handler broke", { cause: new Error("upstream down") }); };
    const base = await start({ handle });
    const response = await fetch(`${base}/x`);
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toBe('{"error":"Internal Server Error"}');
    expect(text).not.toMatch(/at |stack|handler broke/);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: "error", method: "GET", route: "/x", status: 500 });
    expect(logs[0].err).toMatchObject({ message: "handler broke", cause: { message: "upstream down" } });
    expect(logs[0].err.stack).toContain("handler broke");
    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes["http.response.status_code"]).toBe(500);
  });

  it("sends a Buffer body and extra headers from the handler", async () => {
    const handle = async () => ({ status: 200, type: "text/plain", body: Buffer.from("hi"), headers: { "cache-control": "max-age=60" } });
    const base = await start({ handle });
    const response = await fetch(`${base}/f`);
    expect(await response.text()).toBe("hi");
    expect(response.headers.get("cache-control")).toBe("max-age=60");
    expect(response.headers.get("content-type")).toBe("text/plain");
  });
});
