import { describe, expect, it, vi } from "vitest";
import { getAffiliateOffers, selectAffiliateOffers } from "./affiliates";

describe("selectAffiliateOffers", () => {
  it("returns only enabled, complete HTTP(S) offers ordered by priority", () => {
    const offers = selectAffiliateOffers([
      { id: "disabled", enabled: false, title: "Disabled", description: "x", ctaLabel: "Open", url: "https://example.com", priority: 100 },
      { id: "unsafe", enabled: true, title: "Unsafe", description: "x", ctaLabel: "Open", url: "javascript:alert(1)", priority: 99 },
      { id: "later", enabled: true, title: "Later", description: "x", ctaLabel: "Open", url: "https://later.example", priority: 1, categories: ["all"] },
      { id: "first", enabled: true, sponsored: true, title: "First", description: "x", ctaLabel: "Open", url: "https://first.example", priority: 2, categories: ["all"] },
    ]);

    expect(offers.map((offer) => offer.id)).toEqual(["first", "later"]);
    expect(offers[0]).toMatchObject({ sponsored: true, categories: ["all"] });
  });

  it("does not publish a placement without its dedicated configuration", async () => {
    vi.stubEnv("SUP_DATABASE_URL", "");
    vi.stubEnv("AFFILIATE_PROJECT_NAME", "");
    await expect(getAffiliateOffers()).resolves.toEqual([]);
    vi.unstubAllEnvs();
  });
});
