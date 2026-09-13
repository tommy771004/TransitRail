import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    // Snapshot suites parse large official artifacts in isolated workers.
    // Bound concurrent copies instead of relaxing per-test timeouts.
    maxWorkers: 4,
  },
});
