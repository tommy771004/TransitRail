import { describe, expect, it } from "vitest";
import { canonicalPathFor, countryFromPath } from "./countryPath";

describe("canonicalPathFor", () => {
  it("keeps the homepage canonical at / whatever market is selected", () => {
    expect(canonicalPathFor("/")).toBe("/");
    expect(canonicalPathFor("")).toBe("/");
  });

  it("collapses a market path to its prerendered trailing-slash index", () => {
    expect(canonicalPathFor("/japan")).toBe("/japan/");
    expect(canonicalPathFor("/united-states/")).toBe("/united-states/");
    expect(canonicalPathFor("/hong_kong")).toBe("/hong-kong/");
  });

  it("never carries search state into the canonical", () => {
    // Callers pass location.pathname, so the query string cannot leak in;
    // the result is a path, not a URL with ?date= or ?origin=.
    expect(canonicalPathFor("/united-states")).not.toMatch(/[?#]/);
  });

  it("declares no canonical for a path no page backs", () => {
    expect(canonicalPathFor("/china/beijing-south-to-shanghai-hongqiao/")).toBeNull();
    expect(canonicalPathFor("/no-such-page")).toBeNull();
  });
});

describe("countryFromPath", () => {
  it("accepts both slug spellings and a trailing slash", () => {
    expect(countryFromPath("/united-kingdom/")).toBe("united_kingdom");
    expect(countryFromPath("/United_Kingdom")).toBe("united_kingdom");
    expect(countryFromPath("/")).toBeUndefined();
  });
});
