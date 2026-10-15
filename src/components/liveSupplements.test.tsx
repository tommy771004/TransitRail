import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { StationCrowdingView } from "./StationCrowding";
import { TripCard } from "./TripCard";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

describe("London station crowding", () => {
  it("names the level in TfL's words and offers the quieter time", () => {
    const html = renderToStaticMarkup(
      <StationCrowdingView
        crowding={{ station: "Oxford Circus Underground Station", level: "busy", measuredAt: "2026-10-15T07:16:00.000Z", usuallyQuietFrom: "10:00" }}
        station="Oxford Circus"
        country="united_kingdom"
      />,
    );
    expect(html).toContain('data-station-crowding="busy"');
    expect(html).toContain("is busy now");
    expect(html).toContain("usually quiet from 10:00");
    expect(html).toContain("TfL live crowding");
  });
});

describe("KTMB live train position", () => {
  it("says where the train is without making the times live", () => {
    const trip = {
      id: "2026-10-15-my-ktmb-9052", country: "malaysia" as const, operator: "KTMB", service: "ETS",
      origin: "Kuala Lumpur", destination: "Rawang", departureTime: "15:06", arrivalTime: "15:44",
      durationMinutes: 38, direct: true, stops: [],
      livePosition: { nearStation: "Sungai Buloh", reportedAt: new Date(Date.now() - 60_000).toISOString() },
    };
    const html = renderToStaticMarkup(<TripCard trip={trip} country="malaysia" index={0} isSaved={false} onSave={vi.fn()} fare={null} />);
    expect(html).toContain("data-live-position");
    expect(html).toContain("Train now near Sungai Buloh");
    expect(html).not.toContain("data-split-flap");
  });
});
