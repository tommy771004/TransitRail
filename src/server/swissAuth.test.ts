import { afterEach, describe, expect, it, vi } from "vitest";
import { searchSwissJourney } from "./swiss";

const OJP_URL = "https://api.opentransportdata.swiss/ojp20";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SWISS_OJP_TOKEN;
});

describe("Swiss OJP authorisation", () => {
  it("says the token is missing when it is, without spending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { status, body } = await searchSwissJourney("Bern", "Lausanne", "2026-08-03");

    expect(status).toBe(501);
    expect(body.error).toBe("Swiss OJP token not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * What the first scrape with diagnostics actually logged, on all five routes:
   *   Swiss OJP returned HTTP 403. {"error": "Access to this API has been disallowed"}
   * The token was configured — the code returns 501 before fetching when it is
   * not — so the message has to point at the subscription, not the secret.
   */
  it("distinguishes a token that is refused from one that is absent", async () => {
    process.env.SWISS_OJP_TOKEN = "configured-but-unsubscribed";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Access to this API has been disallowed" }),
      { status: 403 },
    )));

    const { status, body } = await searchSwissJourney("Bern", "Lausanne", "2026-08-03");

    expect(status).toBe(502);
    expect(body.results).toEqual([]);
    expect(body.message).toContain("set but not authorised");
    expect(body.message).toContain("OJP 2.0");
    expect(body.message).not.toContain("token not configured");
  });

  it("reports other upstream failures without blaming authorisation", async () => {
    process.env.SWISS_OJP_TOKEN = "valid";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream exploded", { status: 500 })));

    const { body } = await searchSwissJourney("Bern", "Lausanne", "2026-08-03");

    expect(body.message).toContain("HTTP 500");
    expect(body.message).not.toContain("authorised");
  });

  it("targets the OJP 2.0 endpoint the portal documents", async () => {
    process.env.SWISS_OJP_TOKEN = "valid";
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response("<xml/>", { status: 200 });
    }));

    await searchSwissJourney("Bern", "Lausanne", "2026-08-03");

    expect(requested[0]).toBe(OJP_URL);
  });
});
