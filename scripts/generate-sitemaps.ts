/**
 * Generate public/sitemap.xml (canonical for GSC) + public/sitemaps/* partials.
 * Also used as the static file Vercel serves at /sitemap.xml (reliable 200).
 *
 * Run: npm run sitemap
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  buildFlatSitemapXml,
  buildPartialUrlset,
  collectSitemapEntries,
  SITE_URL,
} from "../src/server/sitemapXml";

const OUTPUT_DIR = resolve("public/sitemaps");

function write(path: string, contents: string) {
  writeFileSync(path, `${contents.trim()}\n`, "utf8");
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const { allEntries, countryEntries, routeEntries, latest } = collectSitemapEntries();
  const flat = buildFlatSitemapXml();

  write(resolve(OUTPUT_DIR, "core.xml"), buildPartialUrlset([{ url: `${SITE_URL}/`, lastmod: latest }]));
  write(resolve(OUTPUT_DIR, "countries.xml"), buildPartialUrlset(countryEntries));
  write(resolve(OUTPUT_DIR, "routes.xml"), buildPartialUrlset(routeEntries));

  // Canonical static files — GSC primary path. Vercel serves these as static
  // (no serverless crash surface). Also write capital-S on Linux for case typos.
  write(resolve("public/sitemap.xml"), flat);
  if (process.platform === "linux") {
    write(resolve("public/Sitemap.xml"), flat);
  }

  mkdirSync(resolve("dist"), { recursive: true });
  write(resolve("dist/sitemap.generated.xml"), flat);

  console.log(
    `Generated public/sitemap.xml: ${allEntries.length} URLs (flat urlset).`,
  );
}

main();
