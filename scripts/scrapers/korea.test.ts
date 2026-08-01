import { describe, expect, it, vi } from "vitest";
import { KoreaScraper } from "./korea";

describe("Korea scheduled scraper", () => {
  it("downloads the Seoul artifact once across the seven-date schedule", async () => {
    const collect = vi.fn(async () => undefined);
    const scraper = new KoreaScraper(collect);
    Object.defineProperty(scraper, "routes", { value: [] });

    await scraper.runAll("2026-08-01");
    await scraper.runAll("2026-08-02");

    expect(collect).toHaveBeenCalledTimes(1);
  });

  it("keeps the KTX snapshot schedule running when the Seoul download fails", async () => {
    const scraper = new KoreaScraper(async () => {
      throw new Error("offline");
    });
    Object.defineProperty(scraper, "routes", { value: [] });

    await expect(scraper.runAll("2026-08-01")).resolves.toEqual([]);
  });
});
