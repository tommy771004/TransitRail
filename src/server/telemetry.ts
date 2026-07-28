import { createHmac, randomUUID } from "node:crypto";

export type TelemetryProperties = Record<string, string | number | boolean | null>;

/**
 * Send only server-generated, non-identifying product events to the Admin
 * Console. Missing configuration and delivery failures never affect the
 * caller. This module must not be imported by browser code.
 */
export async function sendTelemetry(name: string, properties: TelemetryProperties): Promise<void> {
  const url = process.env.TELEMETRY_INGEST_URL;
  const project = process.env.TELEMETRY_PROJECT_KEY;
  const secret = process.env.TELEMETRY_INGEST_KEY;
  if (!url || !project || !secret) return;

  const rawBody = JSON.stringify({
    events: [
      {
        id: randomUUID(),
        name,
        source: "server",
        occurredAt: new Date().toISOString(),
        properties,
      },
    ],
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telemetry-project": project,
        "x-telemetry-timestamp": timestamp,
        "x-telemetry-signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      console.warn(`[telemetry] ${name} rejected: ${response.status}`);
    }
  } catch (error) {
    // Do not call the generic error logger here: doing so could recurse forever
    // when telemetry delivery is itself unavailable.
    console.warn("[telemetry] delivery failed:", error instanceof Error ? error.message : error);
  }
}
