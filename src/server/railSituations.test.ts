import { describe, expect, it } from "vitest";
import { parseEnturSituations, parseIrailDisturbances, parseOdptTrainInformation } from "./railSituations";

describe("Belgian disturbances", () => {
  it("reads live disturbances as minor, planned works and restored service as information", () => {
    const situations = parseIrailDisturbances({
      disturbance: [
        { id: "0", title: "Denderleeuw - Zottegem: Situation restored", description: "The problem has been solved.", type: "disturbance", timestamp: "1792047612" },
        { id: "1", title: "Bruges / Brugge", description: "Infrabel is working on the track.", type: "planned", timestamp: "1791961656" },
        { id: "2", title: "  ", type: "disturbance" },
        { id: "3", title: "Brussels-South: signalling fault", type: "disturbance" },
      ],
    });
    expect(situations.map((situation) => [situation.title, situation.severity])).toEqual([
      ["Denderleeuw - Zottegem: Situation restored", "info"],
      ["Bruges / Brugge", "info"],
      ["Brussels-South: signalling fault", "minor"],
    ]);
    expect(situations[0]).toMatchObject({ country: "belgium", source: "SNCB-NMBS", updatedAt: "2026-10-15T07:00:12.000Z" });
  });
});

describe("ODPT train information", () => {
  const normal = {
    "odpt:railway": "odpt.Railway:Toei.Asakusa",
    "odpt:trainInformationText": { ja: "現在、１５分以上の遅延はありません。" },
  };

  it("reports nothing for a line running normally", () => {
    expect(parseOdptTrainInformation([normal])).toEqual([]);
  });

  it("names the line and keeps the operator's own words", () => {
    const [situation] = parseOdptTrainInformation([normal, {
      "dc:date": "2026-10-15T16:12:00+09:00",
      "odpt:railway": "odpt.Railway:Toei.Oedo",
      "odpt:trainInformationStatus": { ja: "運転見合わせ" },
      "odpt:trainInformationText": { ja: "信号確認のため、運転を見合わせています。" },
    }]);
    expect(situation).toMatchObject({
      country: "japan",
      title: "都営大江戸線：運転見合わせ",
      description: "信号確認のため、運転を見合わせています。",
      severity: "major",
      source: "東京都交通局",
    });
  });
});

describe("Entur situations", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const situation = (id: string, startTime?: string, endTime?: string, severity = "normal") => ({
    id,
    summary: [{ value: "Bane NOR utfører vedlikeholdsarbeid.", language: "no" }, { value: "Bane NOR is carrying out maintenance work.", language: "en" }],
    severity,
    validityPeriod: { startTime, endTime },
  });

  it("prefers English and keeps current and soon-starting situations", () => {
    const parsed = parseEnturSituations([
      situation("current", "2026-10-14T00:00:00Z", "2026-10-20T00:00:00Z", "severe"),
      situation("soon", "2026-10-18T00:00:00Z"),
      situation("ended", "2026-10-01T00:00:00Z", "2026-10-10T00:00:00Z"),
      situation("far", "2026-12-01T00:00:00Z"),
    ], now);
    expect(parsed.map((item) => item.id)).toEqual(["no-current", "no-soon"]);
    expect(parsed[0]).toMatchObject({ title: "Bane NOR is carrying out maintenance work.", severity: "major", country: "norway" });
  });
});
