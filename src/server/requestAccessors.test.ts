import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("server request accessors", () => {
  it("does not route API parsing or error reporting through Vercel's legacy accessors", () => {
    const source = readFileSync(new URL("../../server.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/\breq\.query\b/);
    expect(source).not.toMatch(/\breq\.path\b/);
  });
});
