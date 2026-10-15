/**
 * Render the brand sources in assets/brand/ into the files public/ serves:
 * favicons, PWA and Apple icons, and the 1200×630 social card.
 *
 * Run by hand after changing a source (npm run brand:assets) and commit the
 * output; the build does not run it. The OG card loads Schibsted Grotesk from
 * Google Fonts, so this needs network access.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright";

const BRAND_DIR = resolve("assets/brand");
const PUBLIC_DIR = resolve("public");

/** Which source each icon size is drawn from: detail steps down as pixels run out. */
const PNG_ICONS: Array<{ source: string; size: number; out: string }> = [
  { source: "icon-tiny.svg", size: 16, out: "favicon-16.png" },
  { source: "icon-small.svg", size: 32, out: "favicon-32.png" },
  { source: "icon-small.svg", size: 48, out: "favicon-48.png" },
  { source: "icon-maskable.svg", size: 180, out: "apple-touch-icon.png" },
  { source: "icon.svg", size: 192, out: "icon-192.png" },
  { source: "icon.svg", size: 512, out: "icon-512.png" },
  { source: "icon-maskable.svg", size: 512, out: "icon-maskable-512.png" },
];

async function renderSvg(page: Page, source: string, size: number): Promise<Buffer> {
  const svg = readFileSync(resolve(BRAND_DIR, source), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">` +
      svg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `) +
      `</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An ICO whose entries are PNG-encoded, which every current browser reads. */
function buildIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const rendered = new Map<string, Buffer>();
    for (const icon of PNG_ICONS) {
      const png = await renderSvg(page, icon.source, icon.size);
      rendered.set(icon.out, png);
      writeFileSync(resolve(PUBLIC_DIR, icon.out), png);
    }
    writeFileSync(
      resolve(PUBLIC_DIR, "favicon.ico"),
      buildIco([16, 32, 48].map((size) => ({ size, png: rendered.get(`favicon-${size}.png`)! }))),
    );
    copyFileSync(resolve(BRAND_DIR, "icon-small.svg"), resolve(PUBLIC_DIR, "favicon.svg"));
    copyFileSync(resolve(BRAND_DIR, "icon.svg"), resolve(PUBLIC_DIR, "pwa-icon.svg"));

    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(pathToFileURL(resolve(BRAND_DIR, "og-image.html")).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const fontLoaded = await page.evaluate(() => document.fonts.check("800 62px 'Schibsted Grotesk'"));
    if (!fontLoaded) throw new Error("Schibsted Grotesk did not load; the OG card would render in a fallback font");
    await page.screenshot({ path: resolve(PUBLIC_DIR, "og-image.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  } finally {
    await browser.close();
  }
  console.log(`Rendered ${PNG_ICONS.length} icons, favicon.ico and og-image.png into public/.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
