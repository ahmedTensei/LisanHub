import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server-only modules (storage providers) are unit-tested here; the marker package throws outside RSC.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
