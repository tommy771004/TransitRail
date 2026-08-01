import { describe, expect, it } from "vitest";
import { buildHongKongServiceHoursAdvisory } from "./hongKongServiceHours";

/**
 * Shaped like the real MTR service-hours page: the line code is rendered
 * server-side, the destination is only a `js_station_<id>` span resolved by the
 * browser, and the page ships commented-out sample rows with literal station
 * names and plausible times.
 */
function page(sections: Array<{ line: string; rows: Array<[number, string, string]> }>): string {
  const table = (rows: Array<[number, string, string]>) => `<table class="table-d table-topline"><tbody>
    <tr><th>To</th><th>First Train</th><th>Last Train</th></tr>
    ${rows.map(([id, first, last]) => `<tr>
      <td class="tr-color"><span class="js_station_${id}" >-</span></td>
      <td class="firstTrain">${first}</td><td>${last}</td>
    </tr>`).join("")}
    <!-- <tr><td class="tr-color">Tuen Mun</td><td class="firstTrain">0500</td><td>2300</td></tr> -->
  </tbody></table>`;
  return sections
    .map((section) => `<h2 class="trainLine ${section.line}"></h2><div>${table(section.rows)}</div>`)
    .join("");
}

const CENTRAL = page([
  { line: "TWL", rows: [[25, "0606", "0054"]] },
  { line: "ISL", rows: [[83, "0607", "0104"], [37, "0607", "0058"]] },
]);

describe("MTR official service hours", () => {
  it("reads the first and last train for the requested direction", () => {
    const advisory = buildHongKongServiceHoursAdvisory(CENTRAL, "Central", "Tsuen Wan", "2026-08-05");

    expect(advisory).toMatchObject({
      coverage: "partial",
      serviceDate: "2026-08-05",
      firstDeparture: "06:06",
      lastDeparture: "00:54",
      source: "MTR official service hours",
    });
  });

  it("reads the row on the requested line, not another line at the same station", () => {
    // Central's Island Line rows sit in the same page and must not be picked up
    // for a Tsuen Wan Line journey.
    const advisory = buildHongKongServiceHoursAdvisory(CENTRAL, "Central", "Tsuen Wan", "2026-08-05");
    expect(advisory.firstDeparture).not.toBe("06:07");
  });

  it("accepts either id MTR uses for a station that appears on two lines", () => {
    // Hong Kong station is 39 on the Tung Chung Line and 44 on the Airport
    // Express; matching only one silently dropped the row.
    for (const id of [39, 44]) {
      const advisory = buildHongKongServiceHoursAdvisory(
        page([{ line: "TCL", rows: [[id, "0602", "0043"]] }]),
        "Tung Chung",
        "Sunny Bay",
        "2026-08-05",
      );
      expect(advisory).toMatchObject({ coverage: "partial", firstDeparture: "06:02", lastDeparture: "00:43" });
    }
  });

  it("ignores the commented-out sample rows the page ships", () => {
    const advisory = buildHongKongServiceHoursAdvisory(
      page([{ line: "TWL", rows: [] }]),
      "Central",
      "Tsuen Wan",
      "2026-08-05",
    );
    expect(advisory.coverage).toBe("unavailable");
    expect(advisory.firstDeparture).toBeUndefined();
  });

  it("fails closed when the line section is missing entirely", () => {
    // The Hong Kong station page carries no Airport Express section, so that
    // route must report unavailable rather than borrow the Tung Chung times.
    const advisory = buildHongKongServiceHoursAdvisory(
      page([{ line: "TCL", rows: [[43, "0601", "0050"]] }]),
      "Hong Kong",
      "Airport",
      "2026-08-05",
    );
    expect(advisory).toMatchObject({ coverage: "unavailable", risk: "unavailable" });
  });

  it("records the requested service day while stating the times are not day-typed", () => {
    const saturday = buildHongKongServiceHoursAdvisory(CENTRAL, "Central", "Tsuen Wan", "2026-08-01");
    const weekday = buildHongKongServiceHoursAdvisory(CENTRAL, "Central", "Tsuen Wan", "2026-08-05");

    expect(saturday.serviceDayType).toBe("saturday");
    expect(weekday.serviceDayType).toBe("weekday");
    // MTR publishes one pair for all day types — the advisory must not imply
    // otherwise, so both days carry the same times and say so in the note.
    expect(saturday.firstDeparture).toBe(weekday.firstDeparture);
    expect(saturday.note).toMatch(/not a separate set per service day/);
  });
});
