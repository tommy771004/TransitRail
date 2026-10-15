import { describe, expect, it } from "vitest";
import { lineBadge } from "./lineBadge";

describe("lineBadge", () => {
  it("draws a provider's short code and keeps the line name beside it", () => {
    expect(lineBadge("Tsuen Wan Line", "TWL")).toEqual({ code: "TWL", text: "Tsuen Wan Line" });
    expect(lineBadge("Oslo-Bergen", "F4")).toEqual({ code: "F4", text: "Oslo-Bergen" });
  });

  it("does not repeat a name that is already the code", () => {
    expect(lineBadge("FB73", "FB73")).toEqual({ code: "FB73", text: "" });
    expect(lineBadge("EW", "EW")).toEqual({ code: "EW", text: "" });
    expect(lineBadge("ETS")).toEqual({ code: "ETS", text: "" });
  });

  it("splits a product category from its train number", () => {
    expect(lineBadge("ICE 28", "ICE 28")).toEqual({ code: "ICE", text: "28" });
    expect(lineBadge("IC 3705", "BE.NMBS.IC3705")).toEqual({ code: "IC", text: "3705" });
  });

  it("keeps ids, slugs and long names as plain text", () => {
    expect(lineBadge("Victoria", "victoria")).toEqual({ text: "Victoria" });
    expect(lineBadge("EUR9301", "BE.NMBS.EUR9301")).toEqual({ text: "EUR9301" });
    expect(lineBadge("Train 7516", "Train 7516")).toEqual({ text: "Train 7516" });
    expect(lineBadge("무궁화 1982", "경부선")).toEqual({ text: "무궁화 1982" });
    expect(lineBadge("Red Line")).toEqual({ text: "Red Line" });
  });

  it("returns empty text when there is nothing to name", () => {
    expect(lineBadge(undefined)).toEqual({ text: "" });
  });
});
