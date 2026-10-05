import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { blockedCountries, countryDataPaths, restoreCountriesFromHead } from "./marketQuarantine";
import { detectRowLossRegressions, type ValidationFinding } from "./timetableValidation";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "transitrail-quarantine-"));
  roots.push(root);
  write(root, files);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "published");
  return root;
}

function write(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

const read = (root: string, path: string) => readFileSync(join(root, path), "utf-8");

describe("market quarantine", () => {
  it("blocks only the markets with a blocking finding", () => {
    const warning: ValidationFinding = { check: "unknown-stations", severity: "warning", country: "japan", message: "x" };
    expect(blockedCountries([
      warning,
      ...detectRowLossRegressions({ korea: 953, germany: 800 }, { korea: 0, germany: 790 }),
    ])).toEqual(["korea"]);
    expect(blockedCountries([warning])).toEqual([]);
  });

  it("owns a market's route files, service-day artifact and scrape-written catalog only", () => {
    const root = repo({
      "src/data/catalog/singapore.json": "{}",
      "src/data/catalog/singapore-menu.json": "{}",
      "src/data/catalog/malaysia.json": "{}",
      "src/data/catalog/station-i18n/labels.json": "{}",
    });
    expect(countryDataPaths("singapore", root)).toEqual([
      "src/data/scraped/singapore",
      "src/data/service-day/singapore.json",
      "src/data/catalog/singapore-menu.json",
      "src/data/catalog/singapore.json",
    ]);
    expect(() => countryDataPaths("../korea", root)).toThrow("Not a market id");
  });

  it("restores a blocked market to the published data and leaves the others' run intact", () => {
    const root = repo({
      "src/data/scraped/korea/busan-seoul.json": "published korea",
      "src/data/scraped/korea/gone.json": "published, then pruned",
      "src/data/scraped/germany/berlin-hamburg.json": "published germany",
      "src/data/service-day/thailand.json": "published thailand",
    });
    write(root, {
      "src/data/scraped/korea/busan-seoul.json": "pruned to nothing",
      "src/data/scraped/korea/new-route.json": "written by this run",
      "src/data/scraped/germany/berlin-hamburg.json": "tonight's germany",
      "src/data/service-day/thailand.json": "tonight's thailand",
    });
    rmSync(join(root, "src/data/scraped/korea/gone.json"));

    restoreCountriesFromHead(["korea"], root);

    expect(read(root, "src/data/scraped/korea/busan-seoul.json")).toBe("published korea");
    expect(read(root, "src/data/scraped/korea/gone.json")).toBe("published, then pruned");
    expect(existsSync(join(root, "src/data/scraped/korea/new-route.json"))).toBe(false);
    expect(read(root, "src/data/scraped/germany/berlin-hamburg.json")).toBe("tonight's germany");
    expect(read(root, "src/data/service-day/thailand.json")).toBe("tonight's thailand");
  });

  it("removes a market that has never been published", () => {
    const root = repo({ "src/data/scraped/germany/berlin-hamburg.json": "published germany" });
    write(root, { "src/data/scraped/norway/oslo-bergen.json": "first run", "src/data/service-day/norway.json": "first run" });

    restoreCountriesFromHead(["norway"], root);

    expect(existsSync(join(root, "src/data/scraped/norway"))).toBe(false);
    expect(existsSync(join(root, "src/data/service-day/norway.json"))).toBe(false);
  });
});
