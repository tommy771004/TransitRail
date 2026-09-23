import { afterEach, describe, expect, it, vi } from "vitest";
import { searchMbtaJourney } from "./mbta";

// A day that is never "today" in Boston, so the search answers from schedules.
const DATE = "2030-09-30";

function schedule(trip: string, route: string, stop: string, sequence: number, time: string) {
  const iso = `${DATE}T${time}:00-04:00`;
  return {
    id: `${trip}-${stop}`,
    type: "schedule",
    attributes: { stop_sequence: sequence, departure_time: iso, arrival_time: iso },
    relationships: {
      trip: { data: { id: trip } },
      route: { data: { id: route } },
      stop: { data: { id: stop } },
    },
  };
}

// Red Line and SL1 in both directions, meeting at South Station.
const SCHEDULES: Record<string, ReturnType<typeof schedule>[]> = {
  "place-harsq": [
    schedule("red-south", "Red", "place-harsq", 1, "07:00"),
    schedule("red-north", "Red", "place-harsq", 9, "08:15"),
  ],
  "place-sstat": [
    schedule("red-south", "Red", "place-sstat", 9, "07:15"),
    schedule("sl1-out", "741", "place-sstat", 1, "07:25"),
    schedule("sl1-in", "741", "place-sstat", 12, "07:45"),
    schedule("red-north", "Red", "place-sstat", 1, "08:00"),
  ],
  "17091": [
    schedule("sl1-out", "741", "17091", 8, "07:45"),
    schedule("sl1-in", "741", "17091", 1, "07:20"),
  ],
};

function stubMbta() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.pathname === "/stops") {
      return json({ data: [
        { id: "place-harsq", attributes: { name: "Harvard" } },
        { id: "place-sstat", attributes: { name: "South Station" } },
      ] });
    }
    if (url.pathname === "/schedules") {
      return json({ data: SCHEDULES[url.searchParams.get("filter[stop]") || ""] ?? [], included: [] });
    }
    return json({ data: [] });
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MBTA Harvard ↔ Logan connection", () => {
  it("connects Harvard to Logan through South Station", async () => {
    stubMbta();
    const response = await searchMbtaJourney("Harvard", "Logan International Airport", DATE);

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      departureTime: "07:00",
      arrivalTime: "07:45",
      transferStations: ["South Station"],
    });
  });

  it("connects Logan back to Harvard the same way", async () => {
    // Only Harvard → Logan used to be wired to the transfer, so the return trip
    // found no single ride and failed on every scraped date.
    stubMbta();
    const response = await searchMbtaJourney("Logan International Airport", "Harvard", DATE);

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      departureTime: "07:20",
      arrivalTime: "08:15",
      transferStations: ["South Station"],
    });
  });
});
