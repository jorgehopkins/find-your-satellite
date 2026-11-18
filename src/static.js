// Serves files from a directory, refusing anything that would leave it.
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const notFound = () => ({ status: 404, type: "application/json", body: JSON.stringify({ error: "Not found" }) });

/**
 * Answers with the file at `relativePath` (still percent-encoded, as in the URL) under `root`, or 404.
 * Safe for development: the browser must revalidate on every use.
 * Returns the same `{ status, type, body, headers }` shape as `handle`.
 */
export async function serveStatic(root, relativePath) {
  let decoded;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return notFound();
  }
  const segments = decoded.split("/");
  // No NUL, backslash, absolute path, empty or ".." segment may get through, however it was written.
  if (decoded === "" || decoded.includes("\0") || decoded.includes("\\") || segments.some((s) => s === "" || s === "." || s === "..")) return notFound();
  const base = resolve(root);
  const file = resolve(base, ...segments);
  if (!file.startsWith(base + sep)) return notFound();
  try {
    const body = await readFile(file);
    return { status: 200, type: TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", body, headers: { "cache-control": "no-cache" } };
  } catch (error) {
    // Missing file or a directory is a plain 404; anything else (permissions, I/O) is a real fault.
    if (error?.code === "ENOENT" || error?.code === "EISDIR" || error?.code === "ENOTDIR") return notFound();
    throw error;
  }
}
