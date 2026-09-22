import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { TransitResult } from "../types";
import { MetroResultView } from "./MetroResultView";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

const trip: TransitResult = {
  id: "metro", country: "hong_kong", operator: "MTR", service: "TWL",
  origin: "Central", destination: "Jordan", departureTime: "10:00",
  direct: true, stops: [],
};
const render = (result = trip) => renderToStaticMarkup(<MetroResultView
  country={result.country} origin={result.origin} destination={result.destination} date="2026-09-13"
  results={[result]} savedIds={new Set()} onModify={() => {}} onSave={() => {}}
/>);

describe("Metro calling sequence", () => {
  it("puts the line sequence only inside the existing collapsed details panel", () => {
    const html = render();
    const hiddenPanel = html.indexOf('hidden=""');
    expect(hiddenPanel).toBeGreaterThan(0);
    expect(html.indexOf("Admiralty")).toBeGreaterThan(hiddenPanel);
    expect(html.indexOf("Tsim Sha Tsui")).toBeGreaterThan(html.indexOf("Admiralty"));
    expect(html.match(/Admiralty/g)).toHaveLength(1);
    expect(html).not.toContain("Show 2 intermediate stops");
    expect(html).not.toMatch(/10:0[1-9]/);
  });

  it("uses the provider calling pattern once, without adding line-map stops or invented times", () => {
    const html = render({ ...trip, stops: ["Central", "Admiralty", "Jordan"], legs: [{
      lineName: "TWL", origin: "Central", destination: "Jordan", departureTime: "10:00",
      stops: ["Central", "Admiralty", "Jordan"],
    }] });
    expect(html.match(/Admiralty/g)).toHaveLength(1);
    expect(html).not.toContain("Tsim Sha Tsui");
    expect(html.match(/\b\d{2}:\d{2}\b/g)).toEqual(["10:00", "10:00"]);
  });

  it("collapses direct per-hop legs into one ride and one stop list", () => {
    const html = render({ ...trip, legs: [
      { lineName: "TWL", origin: "Central", destination: "Admiralty", departureTime: "10:00", arrivalTime: "10:03" },
      { lineName: "TWL", origin: "Admiralty", destination: "Jordan", departureTime: "10:03", arrivalTime: "10:08" },
    ] });
    expect(html.match(/Admiralty/g)).toHaveLength(1);
    expect(html).not.toContain("Transfer at");
    expect(html).not.toContain("Tsim Sha Tsui");
  });

  it("keeps separate transfer legs and omits duplicate endpoints from their stop lists", () => {
    const html = render({ ...trip, direct: false, legs: [
      { lineName: "First ride", origin: "Central", destination: "ChangeHere", stops: ["Central", "FirstStop", "ChangeHere"] },
      { lineName: "Second ride", origin: "ChangeHere", destination: "Jordan", stops: ["ChangeHere", "SecondStop", "Jordan"] },
    ] });
    expect(html.match(/FirstStop/g)).toHaveLength(1);
    expect(html.match(/SecondStop/g)).toHaveLength(1);
    // Named once on the card's composition line and once in the timeline —
    // never inside either ride's stop list.
    expect(html.match(/ChangeHere/g)).toHaveLength(2);
    expect(html).toContain("Change at ChangeHere to Second ride");
    expect(html).toContain("Transfer at ChangeHere");
  });

  it("uses country-specific station labels", async () => {
    await i18n.changeLanguage("zh-TW");
    try { expect(render()).toContain("金鐘"); }
    finally { await i18n.changeLanguage("en"); }
  });
});
