import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { countriesForSituationFeed, migrateTransitAlerts, situationsForCountries, persistTransitAlerts, MAX_USER_ALERTS, renderTransitAlert } from "./alertFeed";
import i18n from "../i18n";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
import type { AppAlert, TransitSituation } from "../types";

const alert = (over: Partial<AppAlert>): AppAlert => ({
  id: over.id || "a", title: over.category === "departure" ? "Departure approaching: Train" : "Timetable updated", body: "b", createdAt: "2026-09-07T00:00:00Z", read: false, ...over,
});

describe("the notifications page carries transit information only", () => {
  it("rejects category impersonation, invalid dates, blank IDs and expired entries", () => {
    expect(migrateTransitAlerts([
      alert({ category: "timetable", title: "Network error" }),
      alert({ id: " " }), alert({ createdAt: "2026-02-30T00:00:00Z" }),
      alert({ createdAt: "2025-01-01T00:00:00Z" }),
    ])).toEqual([]);
  });
  it("deduplicates and caps persisted notices", () => {
    const rows = Array.from({ length: 150 }, (_, i) => alert({ id: String(i) }));
    expect(migrateTransitAlerts([...rows, ...rows])).toHaveLength(MAX_USER_ALERTS);
  });
  it("removes legacy storage only after a successful write, and contains quota errors", () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    expect(persistTransitAlerts([], storage)).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledWith("transitrail.alerts");
    vi.mocked(storage.removeItem).mockClear();
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(persistTransitAlerts([], storage)).toBe(false);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("renders structured events in the current language without trusting saved copy", () => {
    const entry = alert({ category: "departure", country: "japan", title: "stored IT text", body: "old translation", event: { kind: "departure", origin: "Tokyo", destination: "Kyoto", service: "Nozomi", time: "12:00" } });
    expect(migrateTransitAlerts([entry])).toHaveLength(1);
    const en = renderTransitAlert(entry, i18n.getFixedT("en"));
    const ja = renderTransitAlert(entry, i18n.getFixedT("ja"));
    expect(en.title).not.toBe(ja.title);
    expect(en.body).toContain("12:00");
    expect(en.body).not.toContain("old translation");
  });
  it("keeps timetable changes and departure reminders", () => {
    const kept = migrateTransitAlerts([
      alert({ id: "1", category: "timetable" }),
      alert({ id: "2", category: "departure" }),
    ]);
    expect(kept.map((entry) => entry.id)).toEqual(["1", "2"]);
  });

  it("migrates legacy passenger notices in every shipped language", () => {
    const migrated = migrateTransitAlerts([
      alert({ id: "en-timetable", title: "Timetable updated", country: "japan" }),
      alert({ id: "zh-timetable", title: "時刻表已更新", country: "japan" }),
      alert({ id: "ja-departure", title: "まもなく出発：のぞみ 1" }),
      alert({ id: "ko-departure", title: "곧 출발: KTX 1" }),
    ]);
    expect(migrated.map(({ id, category }) => ({ id, category }))).toEqual([
      { id: "en-timetable", category: "timetable" },
      { id: "zh-timetable", category: "timetable" },
      { id: "ja-departure", category: "departure" },
      { id: "ko-departure", category: "departure" },
    ]);
  });

  it("drops legacy IT, system and tap-receipt messages", () => {
    expect(migrateTransitAlerts([
      alert({ id: "legacy-receipt", title: "Route Added", body: "Added to Favorite Routes." }),
      alert({ id: "legacy-error", title: "Search failed", body: "upstream 502 from provider" }),
      alert({ id: "legacy-network", title: "Network error", body: "Failed to fetch" }),
      alert({ id: "legacy-cache", title: "Offline Mode", body: "Showing cached results" }),
      alert({ id: "legacy-permission", title: "Notifications blocked", body: "Browser permission denied" }),
    ])).toEqual([]);
  });

  it("treats malformed local storage as an empty feed without discarding valid rows", () => {
    expect(migrateTransitAlerts({ alerts: [] })).toEqual([]);
    expect(migrateTransitAlerts("not an alert array")).toEqual([]);
    expect(migrateTransitAlerts([
      null,
      { id: "missing-fields" },
      alert({ id: "bad-country", category: "timetable", country: "unknown" as AppAlert["country"] }),
      alert({ id: "valid", category: "departure" }),
    ])).toEqual([alert({ id: "valid", category: "departure" })]);
  });

  it("is idempotent once alerts use the versioned categories", () => {
    const current = [alert({ id: "1", category: "timetable" })];
    expect(migrateTransitAlerts(migrateTransitAlerts(current))).toEqual(current);
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

  it("includes recent searches as well as the active and saved markets", () => {
    expect([...countriesForSituationFeed(
      "japan",
      [{ country: "switzerland" }],
      [{ country: "united_kingdom" }],
      [{ country: "united_states" }, { country: "japan" }],
    )]).toEqual(["japan", "switzerland", "united_kingdom", "united_states"]);
  });
});
