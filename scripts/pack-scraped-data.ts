/**
 * Pack src/data/scraped into build/scraped — the compressed copy the Vercel
 * function ships instead of the plain JSON (see src/data/scraped/storage.ts).
 *
 * Run: npm run build (last step), or `tsx scripts/pack-scraped-data.ts` alone.
 */
import { resolve } from "path";
import { PACKED_DATA_DIR, packScrapedData } from "../src/data/scraped/storage";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const summary = packScrapedData(resolve("src/data/scraped"), resolve(PACKED_DATA_DIR));
console.log(
  `[pack-scraped] ${summary.files} files, ${mb(summary.sourceBytes)} -> ${mb(summary.packedBytes)} in ${PACKED_DATA_DIR}/`,
);
