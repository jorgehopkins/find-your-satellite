import { describe, expect, it } from "vitest";
import { handle } from "../src/app.js";

describe("the app", () => {
  it("says hello on its home page", async () => {
    expect(await handle({ method: "GET", url: "/" })).toMatchObject({ status: 200, body: expect.stringContaining("Hello") });
  });

  it("answers its health check", async () => {
    expect(JSON.parse((await handle({ method: "GET", url: "/health" })).body)).toEqual({ status: "ok" });
  });

  it("says when there's nothing at an address", async () => {
    expect((await handle({ method: "GET", url: "/nowhere" })).status).toBe(404);
  });

  it("ignores the query string when routing", async () => {
    expect((await handle({ method: "GET", url: "/health?x=1" })).status).toBe(200);
  });
});
