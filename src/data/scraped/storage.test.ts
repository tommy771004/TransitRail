import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { packScrapedData, packedData, sourceTreeData } from "./storage";

const roots: string[] = [];

function tree(files: Record<string, string | Buffer>): string {
  const root = mkdtempSync(join(tmpdir(), "scraped-storage-"));
  roots.push(root);
  for (const [name, contents] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), contents);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("scraped data pack", () => {
  const artifact = gzipSync(JSON.stringify({ runs: [] }));
  const files = {
    "japan/shibuya-asakusa.json": JSON.stringify({ origin: "Shibuya", results: [] }),
    "japan/metadata.json": JSON.stringify({ lastScraped: "2026-10-22" }),
    "korea/seoul-subway-timetable.json.gz": artifact,
    "korea/seoul-busan.json": JSON.stringify({ origin: "Seoul", results: [] }),
  };

  it("reads back exactly what the source tree holds, under the source names", () => {
    const source = tree({ ...files, "index.ts": "export {};", "japan/notes.txt": "skip" });
    const out = join(tree({}), "pack");
    packScrapedData(source, out);

    const plain = sourceTreeData(source);
    const pack = packedData(out)!;
    expect(pack.packed).toBe(true);
    expect(pack.list("japan").sort()).toEqual(["metadata.json", "shibuya-asakusa.json"]);
    expect(pack.list("korea").sort()).toEqual(["seoul-busan.json", "seoul-subway-timetable.json.gz"]);
    for (const name of Object.keys(files)) {
      const [country, file] = name.split("/");
      expect(pack.exists(country, file)).toBe(true);
      expect(pack.read(country, file).equals(plain.read(country, file))).toBe(true);
    }
    expect(pack.exists("japan", "notes.txt")).toBe(false);
    expect(pack.list("china")).toEqual([]);
  });

  it("compresses JSON and copies already-compressed files unchanged", () => {
    const source = tree(files);
    const out = join(tree({}), "pack");
    const summary = packScrapedData(source, out);

    expect(summary.files).toBe(4);
    expect(readFileSync(join(out, "korea/seoul-subway-timetable.json.gz")).equals(artifact)).toBe(true);
    expect(() => readFileSync(join(out, "japan/shibuya-asakusa.json"))).toThrow();
    expect(readFileSync(join(out, "japan/shibuya-asakusa.json.gz"))[0]).toBe(0x1f);
  });

  it("drops files the source tree no longer has", () => {
    const out = join(tree({}), "pack");
    packScrapedData(tree(files), out);
    packScrapedData(tree({ "japan/metadata.json": "{}" }), out);

    expect(packedData(out)!.list("korea")).toEqual([]);
    expect(() => readFileSync(join(out, "korea/seoul-busan.json.gz"))).toThrow();
  });

  it("refuses two source files that would share one pack entry", () => {
    const source = tree({ "korea/a.json": "{}", "korea/a.json.gz": gzipSync("{}") });
    expect(() => packScrapedData(source, join(tree({}), "pack"))).toThrow(/collides/);
  });

  it("is not a pack until its manifest is written", () => {
    expect(packedData(tree({ "japan/shibuya-asakusa.json.gz": gzipSync("{}") }))).toBeUndefined();
  });

  it("falls back rather than throwing on a damaged manifest", () => {
    expect(packedData(tree({ "manifest.json": "{\"version\":1," }))).toBeUndefined();
    expect(packedData(tree({ "manifest.json": "{\"version\":99,\"files\":{}}" }))).toBeUndefined();
  });
});
