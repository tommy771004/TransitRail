import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    // Snapshot suites parse large official artifacts in isolated workers.
    // Bound concurrent copies instead of relaxing per-test timeouts.
    maxWorkers: 4,
    // Those same suites legitimately spend 3-5s loading the committed artifacts
    // for 14 markets, which sat on top of Vitest's 5s default: the catalog and
    // search-reason suites passed alone and failed in a full run, where four
    // workers contend. This is a backstop against a genuinely hung test, not a
    // budget any test is expected to spend.
    testTimeout: 20_000,
  },
});
