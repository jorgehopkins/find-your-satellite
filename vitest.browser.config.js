// The real-browser check, kept apart from `npm test`: `npm run test:browser`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["browser/**/*.browser.js"], testTimeout: 30_000 },
});
