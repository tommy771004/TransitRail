import { describe, expect, it, vi } from "vitest";
import { createJrCentralTimetableProvider } from "./jrCentralTimetable";

describe("JR Central scheduled journey provider", () => {
  it("downloads dated official Nozomi journey results without inventing headways", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("HOUR=6")) {
        return new Response(`
          <script>
            RouteCsv[0] = "0_0,1,新幹線のぞみ,東京,新大阪,552.6km,142分,8910円,5810円,1,1,#0,06:00,08:22,,のぞみ1号（N700S系）";
          </script>
        `, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("<html></html>", { status: 200 });
    });
    const search = createJrCentralTimetableProvider({ fetcher, sampleHours: [6, 7] });

    const response = await search("Tokyo", "Shin-Osaka", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.source).toContain("JR Central official journey search");
    expect(response.body.message).toContain("sampled hourly");
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      operator: "JR Central",
      service: "Nozomi 1",
      departureTime: "06:00",
      arrivalTime: "08:22",
      durationMinutes: 142,
      price: 14720,
      currency: "JPY",
      origin: "Tokyo",
      destination: "Shin-Osaka",
      stops: ["Tokyo", "Shin-Osaka"],
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("YEAR=126&MONH=7&DATE=3&HOUR=6");
    expect(String(fetcher.mock.calls[0][0])).toContain("EKIS=%c5%ec%b5%fe");
    expect(String(fetcher.mock.calls[0][0])).toContain("EKIE=%bf%b7%c2%e7%ba%e5");
  });

  it("answers San'yō pairs from the same joint timetable, credited to the operating company", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("HOUR=6")) {
        return new Response(`
          <script>
            RouteCsv[0] = "0_0,1,山陽新幹線みずほ,新大阪,博多,553.7km,150分,9790円,5150円,1,1,#0,06:00,08:30,,みずほ601号（N700系）";
          </script>
        `, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("<html></html>", { status: 200 });
    });
    const search = createJrCentralTimetableProvider({ fetcher, sampleHours: [6] });

    const response = await search("Shin-Osaka", "Hakata", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      operator: "JR West",
      service: "Mizuho 601",
      departureTime: "06:00",
      arrivalTime: "08:30",
      durationMinutes: 150,
      origin: "Shin-Osaka",
      destination: "Hakata",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("EKIS=%bf%b7%c2%e7%ba%e5");
    expect(String(fetcher.mock.calls[0][0])).toContain("EKIE=%c7%ee%c2%bf");
  });

  it("rejects routes not covered by JR Central instead of returning generated rows", async () => {
    const fetcher = vi.fn();
    const search = createJrCentralTimetableProvider({ fetcher });

    const response = await search("Tokyo", "Hakata", "2026-08-03");

    expect(response.status).toBe(404);
    expect(response.body.results).toEqual([]);
    expect(response.body.error).toBe("JR_CENTRAL_ROUTE_NOT_CONFIGURED");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
