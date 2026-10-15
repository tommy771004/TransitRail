import { describe, expect, it } from "vitest";
import { buildDescription, type DescriptionContext } from "./generate-route-pages";

const oslo: DescriptionContext = {
  origin: "Oslo S",
  destination: "Stavanger stasjon",
  count: 6,
  first: "08:54",
  last: "10:30",
  fastest: "2 hr 52 min",
  typical: "2 hr 52 min",
  price: null,
  services: "R12 + foot + Oslo-Stavanger + foot + FB40 + foot, FLY2 + foot + Oslo-Stavanger + foot + FB40 + foot",
  headway: "",
  indicative: false,
};

describe("buildDescription", () => {
  it("keeps the service list when the description fits", () => {
    const description = buildDescription(
      { ...oslo, origin: "Tokyo", destination: "Kyoto", services: "Nozomi", price: "¥14,170" },
      "en",
    );
    expect(description).toBe("6 trains a day from Tokyo to Kyoto on Nozomi. First 08:54, last 10:30, fastest 2 hr 52 min, from ¥14,170.");
  });

  it("drops a multi-leg service list that would overflow the snippet", () => {
    const description = buildDescription(oslo, "en");
    expect(description).toBe("6 trains a day from Oslo S to Stavanger stasjon. First 08:54, last 10:30, fastest 2 hr 52 min.");
  });

  it("does not double the period after a German abbreviation", () => {
    const description = buildDescription({ ...oslo, services: "", fastest: "2 Std. 52 Min." }, "de");
    expect(description.endsWith("2 Std. 52 Min.")).toBe(true);
    expect(buildDescription({ ...oslo, services: "", fastest: "2 Std. 52 Min.", price: "120 kr" }, "de"))
      .toMatch(/ab 120 kr\.$/);
  });
});
