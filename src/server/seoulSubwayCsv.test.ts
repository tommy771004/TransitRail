import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decodeSeoulSubwayArtifact } from "../data/seoulSubwayArtifact";
import { collectSeoulSubwayArtifact, createSeoulSubwayCsvProvider } from "./seoulSubwayCsv";

const OFFICIAL_CSV = [
  "고유번호,호선,역사코드,역사명,주중주말,방향,급행여부,열차코드,열차도착시간,열차출발시간,출발역,도착역",
  "400,1,0150,서울역,DAY,UP,0,K802,05:20:00,05:20:30,구로,동두천",
  "401,1,0151,시청,DAY,UP,0,K802,05:22:30,05:23:00,구로,동두천",
  "",
].join("\n");

describe("Seoul subway official CSV provider", () => {
  it("discovers the latest official file and returns real scheduled journeys", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const requested = String(url);
      if (requested.endsWith("/data/15098251/fileData.do")) {
        return new Response(
          '<script type="application/ld+json">{"contentUrl":"https://files.example/seoul.csv"}</script>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (requested === "https://files.example/seoul.csv") {
        return new Response(OFFICIAL_CSV, {
          status: 200,
          headers: { "content-type": "text/csv" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    const search = createSeoulSubwayCsvProvider({ fetcher });

    const response = await search("Seoul Station", "City Hall", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("Seoul Metro official timetable CSV");
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      operator: "Seoul Metro",
      departureTime: "05:20",
      arrivalTime: "05:22",
      durationMinutes: 2,
    });
    expect(response.body.results[0].price).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("publishes a validated local gzip artifact for scheduled search", async () => {
    const artifactPath = join(mkdtempSync(join(tmpdir(), "transitrail-seoul-")), "timetable.json.gz");
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("fileData.do")) {
        return new Response('{"contentUrl":"https://files.example/seoul.csv"}', { status: 200 });
      }
      return new Response(OFFICIAL_CSV, {
        status: 200,
        headers: { "content-type": "text/csv" },
      });
    });

    await collectSeoulSubwayArtifact({
      fetcher,
      artifactPath,
      allowedDownloadHosts: ["files.example"],
      minimumRuns: 1,
      minimumStations: 2,
    });

    const artifact = decodeSeoulSubwayArtifact(readFileSync(artifactPath));
    expect(artifact.runs).toHaveLength(1);
    expect(artifact.stations).toEqual(["Seoul Station", "City Hall"]);

    const previous = readFileSync(artifactPath);
    writeFileSync(artifactPath, previous);
    await expect(
      collectSeoulSubwayArtifact({
        fetcher: async () => new Response("offline", { status: 503 }),
        artifactPath,
        minimumRuns: 1,
        minimumStations: 2,
      }),
    ).rejects.toThrow(/503/);
    expect(readFileSync(artifactPath)).toEqual(previous);
  });
});
