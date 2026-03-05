import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    sequence: {
      concurrent: false,
    },
    testTimeout: 30_000,
  },
});
