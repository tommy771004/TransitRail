/**
 * Route social cards: 1200×630 PNGs in the network-map style of the site card
 * (assets/brand/og-image.html).
 *
 * Social platforms ignore SVG og:images, so the card is rasterised with resvg.
 * resvg sees only the fonts committed under assets/fonts/og — never system
 * fonts, which a build machine may lack — so a card whose text has a glyph
 * outside those subsets is not rendered at all; the page then keeps the site
 * card rather than shipping boxes for missing characters. `npm run brand:fonts`
 * re-subsets the fonts when new station labels need it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { Blob, Buffer as ShapeBuffer, Face, Font, shape } from "harfbuzzjs";

/** Which CJK face, if any, the card needs alongside the Latin one. */
export type CardScript = "latin" | "tc" | "jp" | "kr";

export interface RouteCard {
  script: CardScript;
  eyebrow: string;
  origin: string;
  destination: string;
  /** Route line colour on the map. */
  accent: string;
  /** First departure and that train's arrival, shown at the two map stations; empty when unknown. */
  departTime: string;
  arriveTime: string;
  /** Up to three label/value pairs along the bottom; the generator leaves out unknown values. */
  stats: Array<{ label: string; value: string }>;
}

export const OG_FONT_DIR = resolve("assets/fonts/og");

/** Font files per script, as `npm run brand:fonts` writes them. */
export const OG_FONT_FILES: Record<CardScript, string[]> = {
  latin: ["SchibstedGrotesk-ExtraBold.ttf", "SchibstedGrotesk-Medium.ttf"],
  tc: ["NotoSansTC-Bold.ttf"],
  jp: ["NotoSansJP-Bold.ttf"],
  kr: ["NotoSansKR-Bold.ttf"],
};

const FAMILY: Record<CardScript, string> = {
  latin: "Schibsted Grotesk",
  tc: "Noto Sans TC",
  jp: "Noto Sans JP",
  kr: "Noto Sans KR",
};

const BRAND = "TransitRail";
const SITE_HOST = "rail-national.vercel.app";

/** Every character the card draws, for coverage checks and font subsetting. */
export function routeCardText(card: RouteCard): string {
  return [
    BRAND,
    SITE_HOST,
    card.eyebrow.toLocaleUpperCase("en"),
    card.origin,
    card.destination,
    card.departTime,
    card.arriveTime,
    ...card.stats.flatMap((stat) => [stat.label, stat.value]),
  ].join("");
}

type Coverage = Record<CardScript, Set<string>>;
let coverageCache: Coverage | null | undefined;

function loadCoverage(): Coverage | null {
  if (coverageCache !== undefined) return coverageCache;
  const file = join(OG_FONT_DIR, "coverage.json");
  if (!existsSync(file)) return (coverageCache = null);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<CardScript, string>;
  coverageCache = Object.fromEntries(
    Object.entries(raw).map(([script, chars]) => [script, new Set(chars)]),
  ) as Coverage;
  return coverageCache;
}

/** Characters on the card that no committed font can draw. */
export function missingGlyphs(card: RouteCard, coverage: Coverage | null = loadCoverage()): string[] {
  if (!coverage) return [...new Set(routeCardText(card))];
  const missing = new Set<string>();
  for (const char of routeCardText(card)) {
    if (/\s/.test(char)) continue;
    if (coverage.latin.has(char) || (card.script !== "latin" && coverage[card.script].has(char))) continue;
    missing.add(char);
  }
  return [...missing];
}

type Weight = 500 | 800;

/** The face resvg draws a weight with: Latin per weight, the one bold CJK face for both. */
function faceFile(script: CardScript, weight: Weight): string {
  if (script !== "latin") return OG_FONT_FILES[script][0];
  return OG_FONT_FILES.latin[weight === 800 ? 0 : 1];
}

const shapers = new Map<string, { font: Font; upem: number }>();

function shaper(file: string): { font: Font; upem: number } {
  let entry = shapers.get(file);
  if (!entry) {
    const face = new Face(new Blob(readFileSync(join(OG_FONT_DIR, file))));
    entry = { font: new Font(face), upem: face.upem };
    shapers.set(file, entry);
  }
  return entry;
}

/**
 * Advance width in px as resvg will lay the text out: each character in the
 * Latin face when it has the glyph, otherwise in the card's CJK face.
 */
export function textWidth(text: string, size: number, weight: Weight, script: CardScript): number {
  const latin = loadCoverage()?.latin;
  const runs: Array<{ file: string; text: string }> = [];
  for (const char of text) {
    const file = script === "latin" || latin?.has(char) || /\s/.test(char)
      ? faceFile("latin", weight)
      : faceFile(script, weight);
    const last = runs[runs.length - 1];
    if (last?.file === file) last.text += char;
    else runs.push({ file, text: char });
  }
  let width = 0;
  for (const run of runs) {
    const { font, upem } = shaper(run.file);
    const buffer = new ShapeBuffer();
    buffer.addText(run.text);
    buffer.guessSegmentProperties();
    shape(font, buffer);
    for (const position of buffer.getGlyphPositions()) width += (position.xAdvance / upem) * size;
  }
  return width;
}

type Measure = (text: string, size: number) => number;

/** Largest size in [min, max] that fits; at the floor, trim with an ellipsis. */
export function fitText(text: string, maxWidth: number, maxSize: number, minSize: number, measure: Measure): { text: string; size: number } {
  for (let size = maxSize; size >= minSize; size -= 2) {
    if (measure(text, size) <= maxWidth) return { text, size };
  }
  const chars = [...text];
  while (chars.length > 1 && measure(`${chars.join("")}…`, minSize) > maxWidth) chars.pop();
  return { text: `${chars.join("").trimEnd()}…`, size: minSize };
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The brand mark from assets/brand/icon.svg at 64-px detail, drawn at (x, y). */
function brandMark(x: number, y: number, size: number): string {
  const scale = size / 512;
  return `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect width="512" height="512" rx="112" fill="#ffffff"/>` +
    `<path clip-path="url(#og-tile)" d="M0 420C96 398 176 454 286 432S448 386 512 406V512H0Z" fill="#d6e8ef"/>` +
    `<rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#d3ddd9" stroke-width="12"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M96 152H416" stroke="#ffffff" stroke-width="96"/><path d="M256 152V272L352 368" stroke="#ffffff" stroke-width="96"/>` +
    `<path d="M96 152H416" stroke="#0f766e" stroke-width="68"/><path d="M256 152V272L352 368" stroke="#e11d48" stroke-width="68"/></g>` +
    `<path d="M152 184V216M360 184V216" stroke="#0f766e" stroke-width="24"/>` +
    `<circle cx="256" cy="152" r="52" fill="#ffffff" stroke="#10231f" stroke-width="22"/></g>`;
}

/** A dark time pill centred on (cx, cy), or nothing when the time is unknown. */
function timePill(cx: number, cy: number, time: string, family: string, measure: Measure): string {
  if (!time) return "";
  const width = Math.max(76, measure(time, 20) + 34);
  return `<rect x="${cx - width / 2}" y="${cy - 17}" width="${width}" height="34" rx="17" fill="#10231f"/>` +
    `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="${family}" font-size="20" font-weight="800" fill="#ffffff">${esc(time)}</text>`;
}

/** Right edge of the text column; the map card starts at x=640. */
const COLUMN_RIGHT = 600;
const STAT_GAP = 22;
const STAT_MIN_WIDTH = 120;

export function renderRouteCardSvg(card: RouteCard): string {
  const family = card.script === "latin"
    ? `'${FAMILY.latin}'`
    : `'${FAMILY.latin}', '${FAMILY[card.script]}'`;
  const bold: Measure = (text, size) => textWidth(text, size, 800, card.script);
  const medium: Measure = (text, size) => textWidth(text, size, 500, card.script);
  const left = 68;
  const columnWidth = COLUMN_RIGHT - left;
  const origin = fitText(card.origin, columnWidth, 60, 28, bold);
  const destination = fitText(card.destination, columnWidth - 52, 50, 26, bold);
  const eyebrowText = card.eyebrow.toLocaleUpperCase("en");
  const eyebrow = fitText(eyebrowText, columnWidth, 15, 12, (text, size) => bold(text, size) + [...text].length * 2.4);
  const originBaseline = 238 + origin.size * 0.4;
  const destinationBaseline = originBaseline + 26 + destination.size;

  // Stats sit in columns as wide as they need (at least STAT_MIN_WIDTH); the
  // last one takes whatever is left, so a long duration shrinks before it trims.
  const shown = card.stats.slice(0, 3);
  let x = left;
  const stats = shown.map((stat, index) => {
    const last = index === shown.length - 1;
    const room = last ? COLUMN_RIGHT - x : columnWidth / 2;
    const value = fitText(stat.value, room, 34, 20, bold);
    const label = fitText(stat.label, room, 15, 11, medium);
    const width = Math.max(STAT_MIN_WIDTH, bold(value.text, value.size), medium(label.text, label.size));
    const svg = `<text x="${x}" y="532" font-family="${family}" font-size="${value.size}" font-weight="800" fill="#10231f">${esc(value.text)}</text>` +
      `<text x="${x}" y="562" font-family="${family}" font-size="${label.size}" font-weight="500" fill="#3d4f4b">${esc(label.text)}</text>` +
      (last ? "" : `<path d="M${x + width + STAT_GAP} 494V572" stroke="#cfd8d5" stroke-width="1.5"/>`);
    x += width + STAT_GAP * 2;
    return svg;
  }).join("");

  // Map card: a faint network for context, then this route in its accent colour.
  const map = `<g transform="translate(640 36)">` +
    `<rect width="524" height="558" rx="28" fill="#fbfcfc"/>` +
    `<g clip-path="url(#og-map)">` +
    `<rect width="524" height="558" fill="url(#og-grid)"/>` +
    `<rect x="372" y="318" width="100" height="72" rx="16" fill="#e2eee2"/>` +
    `<rect x="26" y="64" width="78" height="100" rx="16" fill="#e2eee2"/>` +
    `<path d="M-20 478C120 440 220 508 340 478S480 418 560 448V600H-20Z" fill="#d6e8ef"/>` +
    `<path d="M-20 478C120 440 220 508 340 478S480 418 560 448" fill="none" stroke="#c2dce6" stroke-width="3"/>` +
    `<g fill="none" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke="#dce4e1">` +
    `<path d="M-20 300H560"/><path d="M300 -20V600"/><path d="M560 70H470L180 360V600"/><path d="M-20 110H120L200 30H560"/></g>` +
    `<g fill="#ffffff" stroke="#c5d0cc" stroke-width="4"><circle cx="300" cy="300" r="10"/><circle cx="240" cy="300" r="10"/><circle cx="300" cy="30" r="10"/></g>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M110 440V330L250 190H420" stroke="#ffffff" stroke-width="38"/>` +
    `<path d="M110 440V330L250 190H420" stroke="${card.accent}" stroke-width="22"/></g>` +
    `<path d="M121 385H137M188 268L198 278M335 201V217" stroke="${card.accent}" stroke-width="12"/>` +
    `<circle cx="110" cy="440" r="20" fill="#ffffff" stroke="#10231f" stroke-width="7"/><circle cx="110" cy="440" r="7" fill="${card.accent}"/>` +
    `<circle cx="420" cy="190" r="26" fill="#ffffff" stroke="#10231f" stroke-width="8"/><circle cx="420" cy="190" r="10" fill="${card.accent}"/>` +
    timePill(196, 440, card.departTime, family, bold) +
    timePill(420, 244, card.arriveTime, family, bold) +
    `<rect x="18" y="506" width="232" height="34" rx="17" fill="#ffffff" stroke="#d5dedb" stroke-width="1.5"/>` +
    `<circle cx="38" cy="523" r="5" fill="#0f766e"/>` +
    `<text x="52" y="529" font-family="${family}" font-size="15" font-weight="500" fill="#3d4f4b">${SITE_HOST}</text>` +
    `</g>` +
    `<rect x="0.75" y="0.75" width="522.5" height="556.5" rx="27.25" fill="none" stroke="#d5dedb" stroke-width="1.5"/>` +
    `</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<defs>` +
    `<clipPath id="og-tile"><rect width="512" height="512" rx="112"/></clipPath>` +
    `<clipPath id="og-map"><rect width="524" height="558" rx="28"/></clipPath>` +
    `<pattern id="og-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e6ecea" stroke-width="1.5"/></pattern>` +
    `</defs>` +
    `<rect width="1200" height="630" fill="#f4f7f6"/>` +
    map +
    brandMark(left, 56, 52) +
    `<text x="${left + 68}" y="93" font-family="${family}" font-size="30" font-weight="800" fill="#10231f">${BRAND}</text>` +
    `<text x="${left}" y="180" font-family="${family}" font-size="${eyebrow.size}" font-weight="800" letter-spacing="2.4" fill="#0f766e">${esc(eyebrow.text)}</text>` +
    `<text x="${left}" y="${originBaseline}" font-family="${family}" font-size="${origin.size}" font-weight="800" fill="#10231f">${esc(origin.text)}</text>` +
    `<path d="M${left + 2} ${destinationBaseline - destination.size * 0.34}H${left + 34}M${left + 22} ${destinationBaseline - destination.size * 0.34 - 12}L${left + 34} ${destinationBaseline - destination.size * 0.34}L${left + 22} ${destinationBaseline - destination.size * 0.34 + 12}" fill="none" stroke="${card.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<text x="${left + 52}" y="${destinationBaseline}" font-family="${family}" font-size="${destination.size}" font-weight="800" fill="#10231f">${esc(destination.text)}</text>` +
    stats +
    `</svg>`;
}

/** The card as PNG, or null when its text needs a glyph no committed font has. */
export function renderRouteCardPng(card: RouteCard): Buffer | null {
  if (missingGlyphs(card).length > 0) return null;
  const fontFiles = [...OG_FONT_FILES.latin, ...(card.script === "latin" ? [] : OG_FONT_FILES[card.script])]
    .map((file) => join(OG_FONT_DIR, file));
  const resvg = new Resvg(renderRouteCardSvg(card), {
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: FAMILY.latin },
    fitTo: { mode: "original" },
  });
  return resvg.render().asPng();
}
