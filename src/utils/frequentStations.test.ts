import { describe, expect, it } from "vitest";
import type { FavoriteRoute, SearchHistoryItem } from "../types";
import { frequentStations } from "./frequentStations";

const search = (origin: string, destination: string, extra: Partial<SearchHistoryItem> = {}): SearchHistoryItem => ({
  id: `${origin}-${destination}`, origin, destination, date: "2026-10-15", country: "japan",
  searchedAt: "2026-10-15T00:00:00Z", resultCount: 3, ...extra,
});
const favorite = (origin: string, destination: string, country: FavoriteRoute["country"] = "japan"): FavoriteRoute => ({
  id: `fav-${origin}-${destination}`, origin, destination, country, createdAt: "2026-10-15T00:00:00Z",
});

describe("frequentStations", () => {
  it("ranks by how often a station is used, favourites and pins counting more", () => {
    const stations = frequentStations(
      [search("Tokyo", "Kyoto"), search("Shinagawa", "Kyoto"), search("Ueno", "Nagoya", { pinned: true })],
      [favorite("Tokyo", "Shin-Osaka")],
      "japan",
    );
    expect(stations).toEqual(["Tokyo", "Shin-Osaka", "Kyoto", "Ueno", "Nagoya", "Shinagawa"]);
  });

  it("keeps first-met order between equal scores", () => {
    expect(frequentStations([search("B", "A"), search("C", "D")], [], "japan")).toEqual(["B", "A", "C", "D"]);
  });

  it("only counts the requested market and caps the row", () => {
    const stations = frequentStations(
      [search("Seoul", "Busan", { country: "korea" }), search("A", "B"), search("C", "D"), search("E", "F")],
      [favorite("Central", "Admiralty", "hong_kong")],
      "japan",
      4,
    );
    expect(stations).toEqual(["A", "B", "C", "D"]);
  });

  it("ignores blank endpoints", () => {
    expect(frequentStations([search("", " "), search("Tokyo", "")], [], "japan")).toEqual(["Tokyo"]);
  });
});
