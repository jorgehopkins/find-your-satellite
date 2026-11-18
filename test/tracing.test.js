import { trace, SpanStatusCode } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { beforeEach, describe, expect, it } from "vitest";
import { withSpan } from "../src/tracing.js";

const exporter = new InMemorySpanExporter();
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }));

describe("withSpan", () => {
  beforeEach(() => exporter.reset());

  it("returns the function's result and ends the span", async () => {
    const result = await withSpan("work", { a: 1 }, async () => 42);
    expect(result).toBe(42);
    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe("work");
    expect(span.attributes).toMatchObject({ a: 1 });
    expect(span.status.code).not.toBe(SpanStatusCode.ERROR);
  });

  it("ends the span, marks it as error and rethrows when the function throws", async () => {
    const boom = new Error("boom");
    await expect(withSpan("work", {}, () => { throw boom; })).rejects.toBe(boom);
    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.some((event) => event.name === "exception")).toBe(true);
  });
});
