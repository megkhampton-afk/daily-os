import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.mjs"],
    environment: "edge-runtime",
  },
});
