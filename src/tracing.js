// Tracing helper. App code uses only `@opentelemetry/api`; with no SDK registered it is a no-op.
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("web-app");

/**
 * Runs `fn(span)` inside a span called `name`. If `fn` throws (or rejects), the exception is
 * recorded, the span is marked as error and the error is rethrown. The span is always ended.
 */
export async function withSpan(name, attributes, fn, options = {}) {
  return tracer.startActiveSpan(name, { ...options, attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}
