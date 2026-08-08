import { createServer, request, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  TELEMETRY_INGEST_URL: process.env.TELEMETRY_INGEST_URL,
  TELEMETRY_PROJECT_KEY: process.env.TELEMETRY_PROJECT_KEY,
  TELEMETRY_INGEST_KEY: process.env.TELEMETRY_INGEST_KEY,
};

const telemetryBodies: Array<{ events?: Array<{ name?: string }> }> = [];
const databaseBodies: string[] = [];
let server: Server;
let app: (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => void;
let consoleError: ReturnType<typeof vi.spyOn>;

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function getSearch() {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP server address");
  }

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port: address.port,
      path: "/api/transit/search?origin=Asakusa&destination=Nihombashi&country=japan&date=2026-08-08",
      method: "GET",
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.DATABASE_URL = "postgresql://debug:debug@example.invalid/transitrail";
  process.env.NODE_ENV = "production";
  process.env.VERCEL = "1";
  process.env.TELEMETRY_INGEST_URL = "https://telemetry.test/ingest";
  process.env.TELEMETRY_PROJECT_KEY = "test-project";
  process.env.TELEMETRY_INGEST_KEY = "test-key";

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === process.env.TELEMETRY_INGEST_URL) {
      telemetryBodies.push(JSON.parse(String(init?.body)) as { events?: Array<{ name?: string }> });
      return new Response(null, { status: 204 });
    }

    databaseBodies.push(String(init?.body));
    return new Response(JSON.stringify({ message: "TN_AUDIT_LOG is unavailable" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }));

  ({ app } = await import("../../server"));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  consoleError.mockRestore();
  vi.unstubAllGlobals();
  restoreEnvironment();
});

describe("transit search audit delivery", () => {
  it("still emits the completed search log when TN_AUDIT_LOG cannot be written", async () => {
    const response = await getSearch();
    await vi.waitFor(() => expect(telemetryBodies.flatMap((body) => body.events ?? [])
      .map((event) => event.name)).toContain("journey.search.completed"));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).results).not.toHaveLength(0);
    expect(databaseBodies.some((body) => body.includes("TN_AUDIT_LOG"))).toBe(true);
    expect(telemetryBodies.flatMap((body) => body.events ?? []).map((event) => event.name))
      .toContain("journey.search.completed");
  });
});
