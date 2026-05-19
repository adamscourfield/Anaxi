import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "modules/**/__tests__/**/*.test.ts",
      "lib/**/__tests__/**/*.test.ts",
    ],
    env: {
      RATE_LIMIT_BACKEND: "memory",
      VITEST: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
