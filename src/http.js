// The HTTP server around `handle`: one server span and one JSON log line per request.
import { createServer } from "node:http";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { handle as appHandle } from "./app.js";
import { withSpan } from "./tracing.js";

/** Writes one JSON line to stdout. */
export const stdoutLog = (fields) => process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...fields })}\n`);

const describeError = (error) => ({
  name: error?.name,
  message: error?.message ?? String(error),
  stack: error?.stack,
  ...(error?.cause === undefined ? {} : { cause: describeError(error.cause) }),
});

/** Creates (without listening) the HTTP server. `handle` and `log` can be replaced, e.g. by tests. */
export function createApp({ handle = appHandle, log = stdoutLog } = {}) {
  return createServer(async (request, response) => {
    const started = performance.now();
    const method = request.method;
    const route = new URL(request.url, "http://localhost").pathname;
    let status = 500;
    await withSpan(`${method} ${route}`, { "http.request.method": method, "http.route": route }, async (span) => {
      try {
        const result = await handle({ method, url: request.url });
        status = result.status;
        response.writeHead(status, { ...result.headers, "content-type": result.type }).end(result.body);
        log({ level: "info", msg: "request", method, route, status, durationMs: Math.round(performance.now() - started) });
      } catch (error) {
        status = 500;
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        log({ level: "error", msg: "request failed", method, route, status, durationMs: Math.round(performance.now() - started), err: describeError(error) });
        // The client is told nothing about the cause.
        if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Internal Server Error" }));
      } finally {
        span.setAttribute("http.response.status_code", status);
      }
    }, { kind: SpanKind.SERVER }).catch((error) => log({ level: "error", msg: "request handling failed", method, route, err: describeError(error) }));
  });
}
