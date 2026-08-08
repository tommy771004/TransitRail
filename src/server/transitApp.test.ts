import { describe, expect, it, vi } from "vitest";
import { createTransitAppClient } from "./transitApp";

const coordinate = { lat: 51.501, lng: -0.141 };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Transit App supplementary data boundary", () => {
  it("reports an unconfigured integration without calling the provider", async () => {
    const fetcher = vi.fn();
    const client = createTransitAppClient({ apiKey: "", fetcher, coordinateForStation: () => coordinate });

    await expect(client.getLiveContext({ country: "united_kingdom", station: "Green Park" })).resolves.toMatchObject({
      status: "unavailable",
      reason: "integration_not_configured",
      provider: "Transit",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("resolves a non-beta network and only returns provider-labelled live data", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/available_networks")) {
        return response({ networks: [{ network_id: "network-1", network_name: "London Transit" }] });
      }
      if (url.pathname.endsWith("/nearby_stops")) {
        return response({ stops: [{ global_stop_id: "stop-1", stop_name: "Green Park" }] });
      }
      if (url.pathname.endsWith("/stops_for_network")) {
        return response({ stops: [{ global_stop_id: "stop-1", stop_name: "Green Park" }] });
      }
      if (url.pathname.endsWith("/stop_departures")) {
        return response({
          route_departures: [{ route_name: "Victoria", merged_itineraries: [{ headsign: "Brixton", schedule_items: [{ departure_time: "2026-08-08T12:03:00Z" }] }] }],
        });
      }
      if (url.pathname.endsWith("/alerts_for_networks")) {
        return response({ alerts: [{ title: "Lift maintenance", description: "Use step-free exit" }] });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const client = createTransitAppClient({ apiKey: "test-key", fetcher, coordinateForStation: () => coordinate, now: () => new Date("2026-08-08T12:00:00Z") });

    const context = await client.getLiveContext({ country: "united_kingdom", station: "Green Park" });

    expect(context).toEqual(expect.objectContaining({
      status: "available",
      provider: "Transit",
      retrievedAt: "2026-08-08T12:00:00.000Z",
      coverage: expect.objectContaining({ networkIds: ["network-1"], stopIds: ["stop-1"] }),
      departures: [expect.objectContaining({ time: "2026-08-08T12:03:00Z", route: "Victoria", headsign: "Brixton" })],
      alerts: [expect.objectContaining({ title: "Lift maintenance" })],
    }));
    expect(fetcher.mock.calls.every(([, init]) => (init as RequestInit).headers instanceof Headers
      && ((init as RequestInit).headers as Headers).get("apiKey") === "test-key")).toBe(true);
  });

  it("rejects beta-only coverage as uncovered rather than claiming no service", async () => {
    const fetcher = vi.fn(async () => response({ networks: [{ network_id: "beta-network", network_in_beta: true }] }));
    const client = createTransitAppClient({ apiKey: "test-key", fetcher, coordinateForStation: () => coordinate });

    await expect(client.resolveCoverage({ country: "united_kingdom", station: "Green Park" })).resolves.toMatchObject({
      status: "uncovered",
      reason: "no_approved_network",
    });
  });

  it("keeps a planner response distinct from verified timetable rows", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/available_networks")) return response({ networks: [{ network_id: "network-1" }] });
      if (url.pathname.endsWith("/nearby_stops")) {
        const station = url.searchParams.get("lat") === String(coordinate.lat) ? "Green Park" : "Oxford Circus";
        return response({ stops: [{ global_stop_id: station === "Green Park" ? "stop-origin" : "stop-destination", stop_name: station }] });
      }
      if (url.pathname.endsWith("/stops_for_network")) {
        const station = url.searchParams.get("lat") === String(coordinate.lat) ? "Green Park" : "Oxford Circus";
        return response({ stops: [{ global_stop_id: station === "Green Park" ? "stop-origin" : "stop-destination", stop_name: station }] });
      }
      if (url.pathname.endsWith("/plan")) return response({ itineraries: [{ duration_seconds: 900, legs: [{ mode: "WALK", duration_seconds: 180 }, { mode: "TRANSIT", route_name: "Victoria" }] }] });
      throw new Error(`Unexpected URL ${url}`);
    });
    const client = createTransitAppClient({
      apiKey: "test-key",
      fetcher,
      coordinateForStation: (station) => station === "Green Park" ? coordinate : { lat: 51.515, lng: -0.141 },
    });

    const plan = await client.planJourney({ country: "united_kingdom", origin: "Green Park", destination: "Oxford Circus", accessibility: "strict" });

    expect(plan).toMatchObject({ status: "available", provider: "Transit", kind: "third_party_plan" });
    expect(plan).not.toHaveProperty("results");
    expect(plan.itineraries?.[0]?.durationMinutes).toBe(15);
    expect(plan.itineraries?.[0]?.legs[0]).toMatchObject({ mode: "WALK" });
  });

  it("marks Preview schedule emptiness as unavailable rather than no service", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/route_details")
        ? response({ route: { route_network_id: "network-1" } })
        : response({ itineraries: [] });
    });
    const client = createTransitAppClient({ apiKey: "test-key", fetcher });

    await expect(client.compareSchedule({ globalRouteId: "route-1", globalStopId: "stop-1", date: "2026-08-08", allowedNetworkIds: ["network-1"] })).resolves.toMatchObject({
      status: "unavailable",
      reason: "preview_schedule_empty",
      requestedDate: "2026-08-08",
    });
  });

  it("requires a real requested service day in Preview schedule output", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/route_details")
        ? response({ route: { route_network_id: "network-1" } })
        : response({ itineraries: [{ schedules: [{ date: "2026-08-09", departures: [{ trip_search_key: "other-day" }] }] }] });
    });
    const client = createTransitAppClient({ apiKey: "test-key", fetcher });

    await expect(client.compareSchedule({ globalRouteId: "route-1", globalStopId: "stop-1", date: "2026-08-08", allowedNetworkIds: ["network-1"] })).resolves.toMatchObject({
      status: "unavailable",
      reason: "preview_schedule_date_unconfirmed",
    });
    await expect(client.compareSchedule({ globalRouteId: "route-1", globalStopId: "stop-1", date: "2026-99-99", allowedNetworkIds: ["network-1"] })).resolves.toMatchObject({
      status: "unavailable",
      reason: "invalid_requested_date",
    });
  });
});
