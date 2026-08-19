/**
 * Belgium-only entry point for the station label sync.
 *
 * The sourcing rules, the Simplified→Traditional conversion and the "no source,
 * no label" contract are shared by every market and live in
 * scripts/sync-station-translations.ts; this wrapper only exists because
 * Belgium was the market the gap was first measured on (696 of 714 live station
 * names had no Traditional Chinese label) and `npm run sync:belgium-stations`
 * is the command that repairs it.
 *
 *   npx tsx scripts/sync-belgium-station-translations.ts
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  process.execPath,
  [resolve(here, "../node_modules/tsx/dist/cli.mjs"), resolve(here, "sync-station-translations.ts"), "belgium", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
