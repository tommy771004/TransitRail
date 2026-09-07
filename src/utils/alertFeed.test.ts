import { describe, expect, it } from "vitest";
import { situationsForCountries, transitAlertsOnly } from "./alertFeed";
import type { AppAlert, TransitSituation } from "../types";

const alert = (over: Partial<AppAlert>): AppAlert => ({
  id: over.id || "a", title: "t", body: "b", createdAt: "2026-09-07T00:00:00Z", read: false, ...over,
});

describe("the notifications page carries transit information only", () => {
  it("keeps timetable changes and departure reminders", () => {
    const kept = transitAlertsOnly([
      alert({ id: "1", category: "timetable" }),
      alert({ id: "2", category: "departure" }),
    ]);
    expect(kept.map((entry) => entry.id)).toEqual(["1", "2"]);
  });

  it("drops entries stored before the page was scoped", () => {
    // These are the shapes already sitting in localStorage: a tap receipt and a
    // provider's raw error text. Filtering only new pushes would have left the
    // page looking unchanged for anyone who had used the app.
    expect(transitAlertsOnly([
      alert({ id: "legacy-receipt", title: "Route Added", body: "Added to Favorite Routes." }),
      alert({ id: "legacy-error", title: "Search failed", body: "upstream 502 from provider" }),
    ])).toEqual([]);
  });
});

const situation = (country: TransitSituation["country"], id: string): TransitSituation => ({
  id, country, title: `${id} disruption`, severity: "minor", source: "Test provider",
});

describe("service status is scoped to the passenger's own networks", () => {
  it("shows only the markets they search or have saved", () => {
    const shown = situationsForCountries(
      [situation("united_kingdom", "tfl"), situation("united_states", "mbta"), situation("switzerland", "sbb")],
      new Set(["switzerland", "united_kingdom"] as const),
    );
    expect(shown.map((entry) => entry.id)).toEqual(["tfl", "sbb"]);
  });

  it("says nothing rather than everything when no market matches", () => {
    expect(situationsForCountries([situation("united_kingdom", "tfl")], new Set(["japan"] as const))).toEqual([]);
  });
});
