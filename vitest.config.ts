import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    // Snapshot suites parse large official artifacts in isolated workers.
    // Bound concurrent copies instead of relaxing per-test timeouts.
    maxWorkers: 4,
  },
});
