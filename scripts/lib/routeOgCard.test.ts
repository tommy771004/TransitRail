import { describe, expect, it } from "vitest";
import { fitText, missingGlyphs, renderRouteCardPng, renderRouteCardSvg, textWidth, type RouteCard } from "./routeOgCard";

const card: RouteCard = {
  script: "jp",
  eyebrow: "日本",
  origin: "新大阪",
  destination: "東京",
  accent: "#be123c",
  departTime: "06:00",
  arriveTime: "08:23",
  stats: [
    { label: "始発", value: "06:00" },
    { label: "終電", value: "21:00" },
    { label: "最速", value: "2時間23分" },
  ],
};

describe("fitText", () => {
  const measure = (text: string, size: number) => [...text].length * size;

  it("keeps the largest size that fits", () => {
    expect(fitText("abcd", 200, 60, 20, measure)).toEqual({ text: "abcd", size: 50 });
  });

  it("trims with an ellipsis once the floor size still overflows", () => {
    expect(fitText("abcdefghij", 100, 60, 20, measure)).toEqual({ text: "abcd…", size: 20 });
  });
});

describe("route social card", () => {
  it("measures with the committed fonts: proportional Latin, full-width CJK", () => {
    expect(textWidth("東京", 40, 800, "jp")).toBeCloseTo(80, 0);
    expect(textWidth("iiii", 40, 800, "latin")).toBeLessThan(textWidth("WWWW", 40, 800, "latin") / 2);
  });

  it("renders a PNG when every glyph is covered", () => {
    expect(missingGlyphs(card)).toEqual([]);
    const png = renderRouteCardPng(card);
    expect(png?.subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("refuses to render text the subset fonts cannot draw", () => {
    const withRareGlyph = { ...card, destination: "𠮷野家" };
    expect(missingGlyphs(withRareGlyph)).toContain("𠮷");
    expect(renderRouteCardPng(withRareGlyph)).toBeNull();
  });

  it("leaves out the arrival pill when the arrival time is unknown", () => {
    const svg = renderRouteCardSvg({ ...card, arriveTime: "" });
    expect(svg.match(/fill="#10231f"\/><text/g)).toHaveLength(1);
  });

  it("escapes station names", () => {
    expect(renderRouteCardSvg({ ...card, script: "latin", origin: "A & B <C>" })).toContain("A &amp; B &lt;C&gt;");
  });
});
