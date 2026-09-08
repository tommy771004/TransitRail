import { describe, expect, it } from "vitest";
import { pruneRouteData } from "./prune-past-dates";

describe("past-date pruning", () => {
  it("removes past rows and makes the file label follow the retained dates", () => {
    const result = pruneRouteData({
      date: "2026-09-07..2026-09-09",
      results: [{ date: "2026-09-07" }, { date: "2026-09-08" }, { date: "2026-09-09" }],
    }, "2026-09-08");

    expect(result.removed).toBe(1);
    expect(result.route.date).toBe("2026-09-08..2026-09-09");
    expect(result.route.results).toEqual([{ date: "2026-09-08" }, { date: "2026-09-09" }]);
  });

  it("repairs a stale label even when there are no more rows to remove", () => {
    const result = pruneRouteData({
      date: "2026-09-07..2026-09-09",
      results: [{ date: "2026-09-08" }, { date: "2026-09-09" }],
    }, "2026-09-08");

    expect(result).toMatchObject({ removed: 0, changed: true });
    expect(result.route.date).toBe("2026-09-08..2026-09-09");
  });

  it("leaves an empty service-hours file's label alone", () => {
    const route = { date: "2026-09-08", results: [] };
    expect(pruneRouteData(route, "2026-09-08")).toEqual({ route, removed: 0, changed: false });
  });
});
