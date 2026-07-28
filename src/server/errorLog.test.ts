import { describe, expect, it } from "vitest";
import { buildErrorLogEvent, sanitizeErrorContext } from "./errorLog";

describe("errorLog privacy and aggregation identity", () => {
  it("removes secrets and identifying request data recursively", () => {
    const context = sanitizeErrorContext({
      origin: "Tokyo",
      apiKey: "secret-api-key",
      authorization: "Bearer secret-token",
      cookie: "session=secret",
      contact: "person@example.com",
      clientIp: "203.0.113.42",
      nested: {
        token: "nested-secret",
        url: "https://provider.test/feed?access_token=secret",
        note: "person@example.com from 203.0.113.42",
      },
    });

    expect(context).toEqual({
      origin: "Tokyo",
      nested: {
        url: "https://provider.test/feed",
        note: "[REDACTED_EMAIL] from [REDACTED_IP]",
      },
    });
  });

  it("uses a stable fingerprint across occurrences but separates routes", () => {
    const base = {
      severity: "warning" as const,
      module: "transit-search",
      operation: "journey.search",
      errorCode: "NO_DATA",
      message: "No timetable data found.",
      country: "japan",
    };
    const first = buildErrorLogEvent({
      ...base,
      occurredAt: new Date("2026-07-28T01:00:00Z"),
      context: { origin: "Tokyo", destination: "Kyoto", date: "2026-07-29", attempt: 1 },
    });
    const repeated = buildErrorLogEvent({
      ...base,
      occurredAt: new Date("2026-07-28T23:00:00Z"),
      context: { origin: "Tokyo", destination: "Kyoto", date: "2026-07-29", attempt: 2 },
    });
    const anotherRoute = buildErrorLogEvent({
      ...base,
      occurredAt: new Date("2026-07-28T23:00:00Z"),
      context: { origin: "Tokyo", destination: "Osaka", date: "2026-07-29" },
    });

    expect(repeated.fingerprint).toBe(first.fingerprint);
    expect(repeated.occurrenceDate).toBe(first.occurrenceDate);
    expect(anotherRoute.fingerprint).not.toBe(first.fingerprint);
  });

  it("redacts credentials embedded in error messages and stack traces", () => {
    const error = new Error(
      "request failed authorization=top-secret at https://provider.test/feed?token=top-secret",
    );
    const event = buildErrorLogEvent({
      severity: "error",
      module: "provider",
      operation: "fetch",
      error,
    });

    expect(event.message).toContain("authorization=[REDACTED]");
    expect(event.message).toContain("https://provider.test/feed");
    expect(event.message).not.toContain("top-secret");
    expect(event.stack).not.toContain("top-secret");
  });
});
