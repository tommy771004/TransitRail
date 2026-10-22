import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Exit status of the ignore step: 0 skips the deployment, 1 builds it. */
function ignoreStep(env: Record<string, string>): number | null {
  const { VERCEL_ENV: _env, VERCEL_GIT_COMMIT_REF: _ref, ...rest } = process.env;
  return spawnSync(process.execPath, ["scripts/vercel-ignore-build.mjs"], {
    env: { ...rest, ...env },
    encoding: "utf8",
  }).status;
}

describe("Vercel ignored build step", () => {
  it("skips previews of agent branches", () => {
    expect(ignoreStep({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "claude/peaceful-newton" })).toBe(0);
  });

  it("builds previews of other branches", () => {
    expect(ignoreStep({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/claude/x" })).toBe(1);
    expect(ignoreStep({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "fix-search" })).toBe(1);
  });

  it("always builds production", () => {
    expect(ignoreStep({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).toBe(1);
    expect(ignoreStep({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "claude/promoted" })).toBe(1);
  });

  it("builds when the system variables are not exposed", () => {
    expect(ignoreStep({})).toBe(1);
  });

  it("is the step vercel.json runs", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { ignoreCommand?: string };
    expect(config.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
  });
});
