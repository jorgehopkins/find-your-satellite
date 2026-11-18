// What the app answers, apart from how it's served, so tests can call it directly.

/**
 * Every request's answer: `{ status, type, body, headers? }`.
 * `body` is a string or a Buffer; `headers` is an optional object of extra response headers.
 */
export async function handle({ method, url }) {
  const path = new URL(url, "http://localhost").pathname;
  if (method === "GET" && path === "/health") return { status: 200, type: "application/json", body: JSON.stringify({ status: "ok" }) };
  if (method === "GET" && path === "/") return { status: 200, type: "text/html; charset=utf-8", body: "<!doctype html><title>Hello</title><h1>Hello</h1>" };
  return { status: 404, type: "application/json", body: JSON.stringify({ error: "Not found" }) };
}
