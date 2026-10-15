/**
 * Subset the route social-card fonts into assets/fonts/og/.
 *
 * Downloads the variable sources from google/fonts (OFL), pins each to the
 * weight the card draws, and keeps only the characters cards can need: Latin
 * through Latin Extended-B for every card, and for each CJK script every
 * sourced station label in that locale plus the text of every current card.
 * coverage.json records what each subset can actually draw, which is what the
 * page generator checks before rendering a card.
 *
 * Run by hand when the generator warns that card fonts lack a glyph
 * (npm run brand:fonts), then commit assets/fonts/og/. Needs network access.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import subsetFont from "subset-font";
import { Blob, Face } from "harfbuzzjs";
import { collectRoutePages } from "./lib/routePages";
import { routeCard } from "./generate-route-pages";
import { OG_FONT_DIR, routeCardText, type CardScript } from "./lib/routeOgCard";

const GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/main/ofl";
const LABELS_FILE = resolve("src/data/catalog/station-i18n/labels.json");

interface FontSpec {
  file: string;
  script: CardScript;
  source: string;
  weight: number;
}

const FONTS: FontSpec[] = [
  { file: "SchibstedGrotesk-ExtraBold.ttf", script: "latin", source: "schibstedgrotesk/SchibstedGrotesk%5Bwght%5D.ttf", weight: 800 },
  { file: "SchibstedGrotesk-Medium.ttf", script: "latin", source: "schibstedgrotesk/SchibstedGrotesk%5Bwght%5D.ttf", weight: 500 },
  { file: "NotoSansTC-Bold.ttf", script: "tc", source: "notosanstc/NotoSansTC%5Bwght%5D.ttf", weight: 700 },
  { file: "NotoSansJP-Bold.ttf", script: "jp", source: "notosansjp/NotoSansJP%5Bwght%5D.ttf", weight: 700 },
  { file: "NotoSansKR-Bold.ttf", script: "kr", source: "notosanskr/NotoSansKR%5Bwght%5D.ttf", weight: 700 },
];

const LICENSES: Record<string, string> = {
  "OFL-SchibstedGrotesk.txt": "schibstedgrotesk/OFL.txt",
  "OFL-NotoSansTC.txt": "notosanstc/OFL.txt",
  "OFL-NotoSansJP.txt": "notosansjp/OFL.txt",
  "OFL-NotoSansKR.txt": "notosanskr/OFL.txt",
};

const LABEL_LOCALE: Record<Exclude<CardScript, "latin">, string> = { tc: "zh-TW", jp: "ja", kr: "ko" };
const CARD_LANG: Record<Exclude<CardScript, "latin">, "zh" | "ja" | "ko"> = { tc: "zh", jp: "ja", kr: "ko" };

/** Basic Latin through Latin Extended-B, plus the punctuation cards use. */
function latinCharacters(): string {
  let chars = "→·–—‘’“”…•×€£¥₩";
  for (let code = 0x20; code <= 0x24f; code++) {
    if (code >= 0x7f && code < 0xa0) continue;
    chars += String.fromCodePoint(code);
  }
  return chars;
}

function scriptCharacters(script: Exclude<CardScript, "latin">): string {
  const labels = JSON.parse(readFileSync(LABELS_FILE, "utf8")) as Record<string, Record<string, Record<string, string>>>;
  const chars = new Set<string>();
  for (const market of Object.values(labels)) {
    for (const label of Object.values(market[LABEL_LOCALE[script]] ?? {})) {
      for (const char of label) chars.add(char);
    }
  }
  for (const page of collectRoutePages()) {
    for (const char of routeCardText(routeCard(page, CARD_LANG[script]))) chars.add(char);
  }
  return [...chars].join("");
}

async function download(path: string): Promise<Buffer> {
  const response = await fetch(`${GOOGLE_FONTS}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  mkdirSync(OG_FONT_DIR, { recursive: true });
  const sources = new Map<string, Buffer>();
  const coverage: Record<string, Set<string>> = {};

  for (const font of FONTS) {
    if (!sources.has(font.source)) sources.set(font.source, await download(font.source));
    const text = font.script === "latin" ? latinCharacters() : scriptCharacters(font.script);
    const subset = await subsetFont(sources.get(font.source)!, text, {
      targetFormat: "truetype",
      variationAxes: { wght: font.weight },
    });
    writeFileSync(join(OG_FONT_DIR, font.file), subset);

    const drawable = new Set(
      [...new Face(new Blob(subset)).collectUnicodes()].map((code) => String.fromCodePoint(code)),
    );
    // A script is covered only where every one of its faces can draw the character.
    const previous = coverage[font.script];
    coverage[font.script] = previous ? new Set([...previous].filter((char) => drawable.has(char))) : drawable;
    console.log(`${font.file}: ${drawable.size} characters, ${(subset.length / 1024).toFixed(0)} KB`);
  }

  for (const [file, path] of Object.entries(LICENSES)) {
    writeFileSync(join(OG_FONT_DIR, file), await download(path));
  }
  writeFileSync(
    join(OG_FONT_DIR, "coverage.json"),
    `${JSON.stringify(Object.fromEntries(Object.entries(coverage).map(([script, chars]) => [script, [...chars].sort().join("")])), null, 0)}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
