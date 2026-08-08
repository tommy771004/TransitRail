import { afterEach, describe, expect, it, vi } from "vitest";
import { germanyGtfsFixture } from "./gtfsZipFixture";
import {
  LTA_GTFS_SCHEDULE_URL,
  resetSingaporeLtaGtfsFeedCache,
  searchSingaporeLtaGtfs,
} from "./singaporeLtaGtfs";

const originalKey = process.env.LTA_ACCOUNT_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  resetSingaporeLtaGtfsFeedCache();
  if (originalKey === undefined) delete process.env.LTA_ACCOUNT_KEY;
  else process.env.LTA_ACCOUNT_KEY = originalKey;
});

describe("LTA DataMall GTFS train feed", () => {
  it("does not make an anonymous request when the account key is absent", async () => {
    delete process.env.LTA_ACCOUNT_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("SINGAPORE_LTA_GTFS_UNAVAILABLE");
    expect(response.body.message).toContain("LTA_ACCOUNT_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses AccountKey to resolve and download the official GTFS archive", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-lta-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ Link: "https://signed.example/lta-gtfs.zip" }] })))
      .mockResolvedValueOnce(new Response(germanyGtfsFixture, { headers: { "last-modified": "Fri, 07 Aug 2026 00:00:00 GMT" } }));
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
    expect(fetchMock).toHaveBeenNthCalledWith(1, LTA_GTFS_SCHEDULE_URL, expect.objectContaining({
      headers: expect.objectContaining({ AccountKey: "test-lta-key", Accept: "application/json" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.example/lta-gtfs.zip", expect.objectContaining({
      headers: expect.not.objectContaining({ AccountKey: expect.anything() }),
    }));
  });

  it("rejects an API response without the short-lived archive link", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-lta-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ value: [] }))));

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "Munich Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.message).toContain("download link");
  });
});
