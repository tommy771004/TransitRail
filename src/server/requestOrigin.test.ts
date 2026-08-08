import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { requestOrigin, requestPath, requestQuery } from "./requestOrigin";

describe("requestOrigin", () => {
  it("prefers the forwarded headers a proxy sets", () => {
    expect(
      requestOrigin({
        headers: { "x-forwarded-proto": "https", "x-forwarded-host": "rail.example", host: "internal:3000" },
      }),
    ).toBe("https://rail.example");
  });

  it("falls back to the Host header when nothing was forwarded", () => {
    expect(requestOrigin({ headers: { host: "rail.example" } })).toBe("http://rail.example");
  });

  it("takes the left-most entry when a request crossed several proxies", () => {
    expect(
      requestOrigin({
        headers: {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "rail.example, inner.example",
        },
      }),
    ).toBe("https://rail.example");
  });

  it("reads a repeated header that Node exposed as an array", () => {
    expect(
      requestOrigin({ headers: { "x-forwarded-host": ["rail.example", "inner.example"] } }),
    ).toBe("http://rail.example");
  });

  it("infers https from a TLS socket", () => {
    expect(requestOrigin({ headers: { host: "rail.example" }, socket: { encrypted: true } })).toBe(
      "https://rail.example",
    );
  });

  it("returns empty rather than an origin built from a missing host", () => {
    expect(requestOrigin({ headers: {} })).toBe("");
    expect(requestOrigin({ headers: { host: "  " } })).toBe("");
  });
});

describe("requestOrigin on platform IncomingMessage", () => {
  afterEach(() => {
    for (const property of ["protocol", "get", "host", "hostname"] as const) {
      delete (IncomingMessage.prototype as unknown as Record<string, unknown>)[property];
    }
  });

  // Vercel's runtime shim backs these accessors with the deprecated url.parse(),
  // which logs a DEP0169 security warning on every request. Building the origin
  // from headers must never reach them.
  it("does not touch req.protocol or req.get()", () => {
    for (const property of ["protocol", "get", "host", "hostname"] as const) {
      Object.defineProperty(IncomingMessage.prototype, property, {
        configurable: true,
        get() {
          throw new Error(`platform ${property} accessor was used`);
        },
      });
    }

    const req = new IncomingMessage(new Socket());
    req.headers = { "x-forwarded-proto": "https", "x-forwarded-host": "rail.example" };

    expect(requestOrigin(req)).toBe("https://rail.example");
  });
});

describe("request URL parsing on platform IncomingMessage", () => {
  it("uses raw request URLs without the platform req.query or req.path accessors", () => {
    const platformRequest = {
      url: "/api/exchange-rates?base=usd&base=eur",
      get query() {
        throw new Error("platform query accessor was used");
      },
      get path() {
        throw new Error("platform path accessor was used");
      },
    };

    expect(requestQuery(platformRequest)).toEqual({ base: "usd" });
    expect(requestPath(platformRequest)).toBe("/api/exchange-rates");
  });
});
