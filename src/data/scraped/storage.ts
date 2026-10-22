/**
 * Where the scraped corpus is read from, and the compressed copy a deployment ships.
 *
 * The repository keeps every route as plain JSON: nightly diffs stay reviewable,
 * `validate:data --against-head` and market quarantine compare against HEAD as
 * text, and git deltas a day's change instead of storing a new opaque blob. A
 * deployment needs none of that, and it paid for the plain files in full — about
 * 226 MB bundled into the function on every deploy, for data that gzips to ~15 MB.
 *
 * So `npm run build` packs the corpus into {@link PACKED_DATA_DIR}: every `.json`
 * gzipped, every file that is already compressed (Korea's subway artifacts)
 * copied as it is, and a manifest written last that maps each file's name in the
 * source tree to its name in the pack. Readers keep asking for source names
 * (`japan/shibuya-asakusa.json`), so nothing above this module knows which form
 * it is reading.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

/** Pack location, relative to the project root. Gitignored with the rest of `build/`. */
export const PACKED_DATA_DIR = "build/scraped";

const MANIFEST_FILE = "manifest.json";
const MANIFEST_VERSION = 1;

interface PackManifest {
  version: number;
  /** Source-tree name (`country/file`) → name inside the pack. */
  files: Record<string, string>;
}

/** A readable corpus: the source tree itself, or a pack built from it. */
export interface ScrapedDataSource {
  dir: string;
  packed: boolean;
  /** File names in one country directory, as the source tree names them. */
  list(country: string): string[];
  exists(country: string, file: string): boolean;
  /** File contents, decompressed back to what the source tree holds. */
  read(country: string, file: string): Buffer;
}

export function sourceTreeData(dir: string): ScrapedDataSource {
  return {
    dir,
    packed: false,
    list: (country) => {
      const path = join(dir, country);
      return existsSync(path) ? readdirSync(path) : [];
    },
    exists: (country, file) => existsSync(join(dir, country, file)),
    read: (country, file) => readFileSync(join(dir, country, file)),
  };
}

/** The pack at `dir`, or `undefined` when no complete pack is there. */
export function packedData(dir: string): ScrapedDataSource | undefined {
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) return undefined;
  let manifest: PackManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackManifest;
  } catch (error) {
    console.warn(`[scraped] Ignoring unreadable data pack manifest ${manifestPath}:`, error);
    return undefined;
  }
  if (manifest.version !== MANIFEST_VERSION || !manifest.files) return undefined;
  const byCountry = new Map<string, string[]>();
  for (const name of Object.keys(manifest.files)) {
    const [country, file] = name.split("/");
    byCountry.set(country, [...(byCountry.get(country) ?? []), file]);
  }
  return {
    dir,
    packed: true,
    list: (country) => byCountry.get(country) ?? [],
    exists: (country, file) => `${country}/${file}` in manifest.files,
    read: (country, file) => {
      const stored = manifest.files[`${country}/${file}`];
      if (!stored) throw new Error(`${country}/${file} is not in the scraped data pack`);
      const bytes = readFileSync(join(dir, stored));
      return stored === `${country}/${file}` ? bytes : gunzipSync(bytes);
    },
  };
}

export interface PackSummary {
  files: number;
  sourceBytes: number;
  packedBytes: number;
}

/**
 * Rebuild the pack at `outDir` from the source tree at `sourceDir`.
 *
 * The previous pack is removed first, so a route deleted from the tree cannot
 * survive in a deployment, and the manifest is written last, so a pack whose
 * build was interrupted is not one {@link packedData} will read.
 */
export function packScrapedData(sourceDir: string, outDir: string): PackSummary {
  rmSync(outDir, { recursive: true, force: true });
  const manifest: PackManifest = { version: MANIFEST_VERSION, files: {} };
  const storedNames = new Set<string>();
  const summary: PackSummary = { files: 0, sourceBytes: 0, packedBytes: 0 };

  const countries = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const country of countries) {
    for (const file of readdirSync(join(sourceDir, country)).sort()) {
      const compress = file.endsWith(".json");
      if (!compress && !file.endsWith(".json.gz")) continue;
      const stored = `${country}/${compress ? `${file}.gz` : file}`;
      // `x.json` and `x.json.gz` would land on the same pack entry.
      if (storedNames.has(stored)) {
        throw new Error(`${country}/${file} collides with another file in the scraped data pack`);
      }
      const source = readFileSync(join(sourceDir, country, file));
      const bytes = compress ? gzipSync(source, { level: 9 }) : source;
      const target = join(outDir, stored);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      manifest.files[`${country}/${file}`] = stored;
      storedNames.add(stored);
      summary.files += 1;
      summary.sourceBytes += source.length;
      summary.packedBytes += bytes.length;
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest)}\n`);
  return summary;
}
