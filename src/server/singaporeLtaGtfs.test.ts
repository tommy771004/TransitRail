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

function resolverResponse(link = "https://signed.example/lta-gtfs.zip") {
  return new Response(JSON.stringify({ value: [{ Link: link }] }));
}

function archiveResponse() {
  return new Response(germanyGtfsFixture, {
    headers: { "last-modified": "Fri, 07 Aug 2026 00:00:00 GMT" },
  });
}

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
      .mockResolvedValueOnce(resolverResponse())
      .mockResolvedValueOnce(archiveResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
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

  it("reads the link out of a lower-cased envelope too", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-lta-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ link: "https://signed.example/lower.zip" }] })))
      .mockResolvedValueOnce(archiveResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.example/lower.zip", expect.anything());
  });

  it("names the credential when DataMall rejects the key", async () => {
    process.env.LTA_ACCOUNT_KEY = "stale-lta-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Invalid AccountKey", { status: 401 })));

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "München Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.results).toEqual([]);
    expect(response.body.message).toContain("rejected LTA_ACCOUNT_KEY");
  });

  it("reports an expired signed archive without inventing results", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-lta-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resolverResponse("https://signed.example/expired.zip"))
      .mockResolvedValueOnce(new Response("expired", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "Munich Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.results).toEqual([]);
    expect(response.body.message).toContain("archive download returned HTTP 403");
  });

  it("rejects an API response without the short-lived archive link", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-lta-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ value: [] }))));

    const response = await searchSingaporeLtaGtfs("Berlin Hbf", "Munich Hbf", "2026-08-03");

    expect(response.status).toBe(502);
    expect(response.body.message).toContain("download link");
  });

  it("attempts the download once per run however many routes ask for it", async () => {
    // The nightly job asks for four routes across seven dates. Retrying a
    // rejected credential twenty-eight times downloads nothing new and buries
    // the one message a human needs.
    process.env.LTA_ACCOUNT_KEY = "stale-lta-key";
    const fetchMock = vi.fn(async () => new Response("Invalid AccountKey", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const response = await searchSingaporeLtaGtfs("Jurong East", "Raffles Place", "2026-08-19");
      expect(response.status).toBe(502);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
