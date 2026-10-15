import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { StationCrowdingView } from "./StationCrowding";
import { TripCard } from "./TripCard";
import { KtmbLiveTrainsView } from "./KtmbLiveTrains";
import { CountryResultsView } from "./CountryResultsView";
import type { TransitResult } from "../types";

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

describe("SNCF trip status on a timetable row", () => {
  const trip = (liveStatus: NonNullable<TransitResult["liveStatus"]>): TransitResult => ({
    id: "2026-10-15-fr-OCESN7829F", country: "france", operator: "SNCF", service: "Train 7829",
    origin: "Paris Gare de Lyon", destination: "Marseille St-Charles", departureTime: "06:03", arrivalTime: "09:24",
    durationMinutes: 201, direct: true, stops: [], liveStatus,
  });
  const card = (status: NonNullable<TransitResult["liveStatus"]>, minutesUntil?: number) => renderToStaticMarkup(
    <TripCard trip={trip(status)} country="france" index={0} isSaved={false} onSave={vi.fn()} fare={null} tags={{ next: true }} minutesUntil={minutesUntil} />,
  );
  const checkedAt = "2026-10-15T08:08:00.000Z";

  it("shows the delay in place of the countdown, never as a live board", () => {
    const html = card({ checkedAt, delayMinutes: 40 }, 5);
    expect(html).toContain("data-live-status");
    expect(html).toContain("+40 min late");
    expect(html).not.toContain("Departs in");
    expect(html).not.toContain("data-split-flap");
    expect(html).toContain("06:03");
  });

  it("says on time and keeps the countdown", () => {
    const html = card({ checkedAt, delayMinutes: 0 }, 5);
    expect(html).toContain("On time");
    expect(html).toContain("5 min");
  });

  it("names a cancellation and a skipped stop", () => {
    expect(card({ checkedAt, cancelled: true }, 5)).toContain("Cancelled");
    expect(card({ checkedAt, skipped: true }, 5)).toContain("Doesn&#x27;t stop here");
  });
});

describe("KTMB live trains", () => {
  const now = new Date("2026-10-15T07:33:30Z");

  it("lists each train with where it runs and where it was last seen", () => {
    const html = renderToStaticMarkup(<KtmbLiveTrainsView now={now} trains={[
      { tripId: "9130", label: "ETS309", service: "ETS", from: "KL Sentral", to: "Butterworth", nearStation: "Kampar", reportedAt: "2026-10-15T07:32:42.000Z" },
      { tripId: "9528", label: "ETS307", service: "ETS", from: "Gemas", to: "KL Sentral", between: ["Seremban", "Kajang"], reportedAt: "2026-10-15T07:32:42.000Z" },
      { tripId: "9999", label: "ETS301", reportedAt: "2026-10-15T07:32:42.000Z" },
    ]} />);
    expect(html.match(/data-live-train=/g)).toHaveLength(3);
    expect(html).toContain(">ETS<");
    expect(html).toContain("ETS309");
    expect(html).toContain("Train now near Kampar");
    expect(html).toContain("Train between Seremban and Kajang");
    expect(html).toContain("Train between stations");
    expect(html).toContain("KL Sentral → Butterworth");
    expect(html).toContain("48 seconds ago");
  });

  it("says a quiet feed is not the same as no service", () => {
    expect(renderToStaticMarkup(<KtmbLiveTrainsView now={now} trains={[]} />)).toContain("does not mean there is no service");
  });

  it("is reachable from Malaysia results only", () => {
    const props = {
      origin: "Kuala Lumpur", destination: "Rawang", date: "2026-10-15", results: [], savedIds: new Set<string>(),
      sortMode: "earliest" as const, koreaFilter: "all" as const, onSortChange: vi.fn(), onKoreaFilterChange: vi.fn(),
      onModify: vi.fn(), onSave: vi.fn(), onSelectSeat: vi.fn(), onOpenLiveTrains: vi.fn(),
    };
    expect(renderToStaticMarkup(<CountryResultsView country="malaysia" {...props} />)).toContain("data-live-trains-entry");
    expect(renderToStaticMarkup(<CountryResultsView country="hong_kong" {...props} />)).not.toContain("data-live-trains-entry");
  });
});
