import { afterEach, describe, expect, it, vi } from "vitest";
import { germanyGtfsFixture, zipFixture } from "./gtfsZipFixture";
import {
  LTA_GTFS_SCHEDULE_URL,
  resetSingaporeLtaGtfsFeedCache,
  searchSingaporeLtaGtfs,
} from "./singaporeLtaGtfs";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSingaporeLtaGtfsFeedCache();
});

describe("LTA DataMall GTFS train feed", () => {
  it("downloads the official static ZIP without requiring an AccountKey", async () => {
    delete process.env.LTA_ACCOUNT_KEY;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(zipFixture({
        "GTFSScheduleTrain.json": JSON.stringify({
          value: [{ link: "https://signed.example/gtfs_schedule.zip" }],
        }),
      })));
    fetchMock.mockResolvedValueOnce(new Response(germanyGtfsFixture, {
      headers: { "last-modified": "Fri, 07 Aug 2026 00:00:00 GMT" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, LTA_GTFS_SCHEDULE_URL, expect.objectContaining({
      headers: expect.objectContaining({ Accept: "application/zip" }),
    }));
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty("AccountKey");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.example/gtfs_schedule.zip", expect.objectContaining({
      headers: expect.objectContaining({ Accept: "application/zip" }),
    }));
  });

  it("builds Singapore timetable results from the official ZIP", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(zipFixture({
        "GTFSScheduleTrain.json": JSON.stringify({
          value: [{ link: "https://signed.example/gtfs_schedule.zip" }],
        }),
      })));
    fetchMock.mockResolvedValueOnce(new Response(germanyGtfsFixture, {
      headers: { "last-modified": "Fri, 07 Aug 2026 00:00:00 GMT" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      country: "singapore",
      operator: "Singapore rail operators",
      departureTime: "23:45",
      arrivalTime: "04:10",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts a direct GTFS archive when the wrapper is not there", async () => {
    // DataMall may drop the wrapper; the reader decides by inspecting the ZIP,
    // so a real archive must be used directly rather than searched for a link.
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(germanyGtfsFixture, {
      headers: { "last-modified": "Fri, 07 Aug 2026 00:00:00 GMT" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a failed static download without inventing results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream unavailable", { status: 503 })));

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "Munich Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.message).toContain("HTTP 503");
  });

  it("reports a stale or rejected signed archive without inventing results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(zipFixture({
        "GTFSScheduleTrain.json": JSON.stringify({
          value: [{ link: "https://signed.example/expired-gtfs.zip" }],
        }),
      })))
      .mockResolvedValueOnce(new Response("expired", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "Munich Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.results).toEqual([]);
    expect(response.body.message).toContain("archive download returned HTTP 403");
  });
});
