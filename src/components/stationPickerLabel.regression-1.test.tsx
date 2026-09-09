// Regression: ISSUE-006 — the origin/destination buttons fell back to English
// aria-labels ("Select Departure Station") in every non-English locale, because
// they read `search.select_origin` / `search.select_dest`, keys that exist in no
// bundle. A station that HAD been picked rendered a translated label, so one
// control pair spoke two languages to a screen reader.
// Found by /qa on 2026-09-09
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-09.md

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { SearchForm } from "./SearchForm";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));

const noop = vi.fn();

function render(params: { origin: string; destination: string }) {
  return renderToStaticMarkup(<SearchForm
    params={{ country: "japan", origin: params.origin, destination: params.destination, date: "2026-09-09" }}
    isSearching={false} recentHistory={[]} favorites={[]}
    onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
    onChange={noop} onSearch={async () => {}} onOpenStations={noop} onOpenWorkflow={noop}
    onRepeatSearch={noop} onTogglePinHistory={noop}
  />);
}

// Every locale the picker ships, with the empty-state label it must announce.
const EMPTY_STATE = {
  "zh-TW": ["選擇出發站", "選擇抵達站"],
  ja: ["出発駅を選択", "到着駅を選択"],
  ko: ["출발역 선택", "도착역 선택"],
  en: ["Choose an origin", "Choose a destination"],
} as const;

afterAll(async () => { await i18n.changeLanguage("en"); });

describe("station picker aria-labels", () => {
  it.each(Object.entries(EMPTY_STATE))("announces the unpicked state in %s", async (lang, [origin, destination]) => {
    await i18n.changeLanguage(lang);
    const html = render({ origin: "", destination: "" });
    expect(html).toContain(`aria-label="${origin}"`);
    expect(html).toContain(`aria-label="${destination}"`);
  });

  it.each(Object.keys(EMPTY_STATE))("never falls back to the English default in %s", async (lang) => {
    await i18n.changeLanguage(lang);
    const html = render({ origin: "", destination: "" });
    if (lang === "en") return; // the English bundle legitimately answers in English
    expect(html).not.toContain("Select Departure Station");
    expect(html).not.toContain("Select Destination Station");
  });

  it("keeps both buttons in one language once a station is picked", async () => {
    await i18n.changeLanguage("zh-TW");
    // The mixed-language pair is the actual defect: a picked origin was
    // translated while the still-empty destination was not.
    const html = render({ origin: "Tokyo", destination: "" });
    expect(html).toContain("aria-label=\"選擇抵達站\"");
    expect(html).not.toContain("Select Destination Station");
    expect(html).toMatch(/aria-label="起點站: [^"]+"/);
  });
});
