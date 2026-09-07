import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

const readRepoFile = (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

// CLAUDE.md and AGENTS.md are the same instructions addressed to different
// agents, kept as two files because each tool only reads its own name. Nothing
// generates one from the other, so without this check an edit to one silently
// leaves the other serving stale rules.
describe("agent instruction files", () => {
  it("keeps AGENTS.md identical to CLAUDE.md apart from the title", async () => {
    const [claude, agents] = await Promise.all([
      readRepoFile("CLAUDE.md"),
      readRepoFile("AGENTS.md"),
    ]);

    const body = (contents: string) => contents.replace(/\r\n/g, "\n").split("\n").slice(1);

    expect(agents.split("\n", 1)[0].trim()).toBe("# AGENTS.md");
    expect(claude.split("\n", 1)[0].trim()).toBe("# CLAUDE.md");
    expect(body(agents)).toEqual(body(claude));
  });

  // The compaction moved detail out of CLAUDE.md into docs/agents/. A reference
  // an agent cannot open is worse than the inline paragraph it replaced.
  it("resolves every reference CLAUDE.md points at", async () => {
    const claude = await readRepoFile("CLAUDE.md");
    const targets = [...claude.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);

    expect(targets.length).toBeGreaterThan(0);
    await expect(Promise.all(targets.map(readRepoFile))).resolves.toBeDefined();
  });
});
