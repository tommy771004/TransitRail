import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { errorLogs, type ErrorLogSeverity } from "../db/schema";
import { sendTelemetry } from "./telemetry";

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 12_000;
const MAX_CONTEXT_STRING_LENGTH = 1_000;
const MAX_CONTEXT_KEYS = 50;
const MAX_CONTEXT_ARRAY_ITEMS = 20;
const MAX_CONTEXT_DEPTH = 4;

const BLOCKED_CONTEXT_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "secret",
  "token",
  "apikey",
  "key",
  "authkey",
  "p256dh",
  "endpoint",
  "contact",
  "email",
  "ip",
  "ipaddress",
  "clientip",
  "useragent",
]);

export interface ErrorLogInput {
  severity: ErrorLogSeverity;
  module: string;
  operation: string;
  error?: unknown;
  errorCode?: string;
  message?: string;
  country?: string;
  provider?: string;
  httpStatus?: number;
  context?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface ErrorLogEvent {
  id: string;
  fingerprint: string;
  occurrenceDate: string;
  severity: ErrorLogSeverity;
  module: string;
  operation: string;
  errorCode?: string;
  message: string;
  stack?: string;
  country?: string;
  provider?: string;
  httpStatus?: number;
  context?: Record<string, unknown>;
  occurredAt: Date;
}

export interface ErrorLogReceipt {
  id: string;
  fingerprint: string;
  occurrenceCount: number;
  stored: boolean;
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function blockedContextKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return BLOCKED_CONTEXT_KEYS.has(normalized)
    || normalized.endsWith("token")
    || normalized.endsWith("secret")
    || normalized.endsWith("password")
    || normalized.endsWith("apikey")
    || normalized.endsWith("authkey");
}

function scrubText(value: string, maxLength: number): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(authorization|api[-_ ]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/https?:\/\/[^\s)]+/gi, (rawUrl) => {
      try {
        const url = new URL(rawUrl);
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        return url.toString();
      } catch {
        return rawUrl.split("?")[0];
      }
    })
    .slice(0, maxLength);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_CONTEXT_DEPTH) return "[MAX_DEPTH]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return scrubText(value, MAX_CONTEXT_STRING_LENGTH);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_CONTEXT_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, MAX_CONTEXT_KEYS)) {
      if (blockedContextKey(key) || nested === undefined) continue;
      sanitized[key] = sanitizeValue(nested, depth + 1);
    }
    return sanitized;
  }
  return scrubText(String(value), MAX_CONTEXT_STRING_LENGTH);
}

export function sanitizeErrorContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return sanitizeValue(context, 0) as Record<string, unknown>;
}

function errorMessage(input: ErrorLogInput): string {
  if (input.message) return scrubText(input.message, MAX_MESSAGE_LENGTH);
  if (input.error instanceof Error) return scrubText(input.error.message, MAX_MESSAGE_LENGTH);
  if (input.error !== undefined) return scrubText(String(input.error), MAX_MESSAGE_LENGTH);
  return "Unknown operational error";
}

function errorStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  return scrubText(error.stack, MAX_STACK_LENGTH);
}

function identityContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!context) return {};
  const identityKeys = ["origin", "destination", "route", "date", "path", "job", "batchId"];
  return Object.fromEntries(
    identityKeys
      .filter((key) => context[key] !== undefined)
      .map((key) => [key, context[key]]),
  );
}

export function buildErrorLogEvent(input: ErrorLogInput): ErrorLogEvent {
  const occurredAt = input.occurredAt ?? new Date();
  const context = sanitizeErrorContext(input.context);
  const message = errorMessage(input);
  const fingerprintPayload = JSON.stringify({
    severity: input.severity,
    module: scrubText(input.module, 120),
    operation: scrubText(input.operation, 160),
    errorCode: input.errorCode ? scrubText(input.errorCode, 160) : undefined,
    country: input.country ? scrubText(input.country, 80) : undefined,
    provider: input.provider ? scrubText(input.provider, 200) : undefined,
    httpStatus: input.httpStatus,
    message,
    context: identityContext(context),
  });

  return {
    id: randomUUID(),
    fingerprint: createHash("sha256").update(fingerprintPayload).digest("hex"),
    occurrenceDate: occurredAt.toISOString().slice(0, 10),
    severity: input.severity,
    module: scrubText(input.module, 120),
    operation: scrubText(input.operation, 160),
    errorCode: input.errorCode ? scrubText(input.errorCode, 160) : undefined,
    message,
    stack: errorStack(input.error),
    country: input.country ? scrubText(input.country, 80) : undefined,
    provider: input.provider ? scrubText(input.provider, 200) : undefined,
    httpStatus: input.httpStatus,
    context,
    occurredAt,
  };
}

/**
 * Persist an operational event and mirror a deliberately small, non-identifying
 * envelope to the Admin Console. Logger failures never throw into product code.
 */
export async function recordError(input: ErrorLogInput): Promise<ErrorLogReceipt> {
  const event = buildErrorLogEvent(input);
  let id = event.id;
  let occurrenceCount = 1;
  let stored = false;

  if (process.env.DATABASE_URL) {
    try {
      const [row] = await db
        .insert(errorLogs)
        .values({
          id: event.id,
          fingerprint: event.fingerprint,
          occurrenceDate: event.occurrenceDate,
          severity: event.severity,
          status: "open",
          module: event.module,
          operation: event.operation,
          errorCode: event.errorCode,
          message: event.message,
          stack: event.stack,
          country: event.country,
          provider: event.provider,
          httpStatus: event.httpStatus,
          occurrenceCount: 1,
          firstContext: event.context,
          lastContext: event.context,
          firstOccurredAt: event.occurredAt,
          lastOccurredAt: event.occurredAt,
          updatedAt: event.occurredAt,
        })
        .onConflictDoUpdate({
          target: [errorLogs.fingerprint, errorLogs.occurrenceDate],
          targetWhere: sql`${errorLogs.status} = 'open'`,
          set: {
            occurrenceCount: sql`${errorLogs.occurrenceCount} + 1`,
            lastContext: event.context,
            lastOccurredAt: event.occurredAt,
            updatedAt: event.occurredAt,
          },
        })
        .returning({
          id: errorLogs.id,
          occurrenceCount: errorLogs.occurrenceCount,
        });

      if (row) {
        id = row.id;
        occurrenceCount = row.occurrenceCount;
        stored = true;
      }
    } catch (loggerError) {
      // Never recurse through recordError when the logger's own database write
      // fails. Telemetry below still gives operators a reduced signal.
      console.error(
        "[error-log] database write failed:",
        loggerError instanceof Error ? loggerError.message : loggerError,
      );
    }
  }

  void sendTelemetry("system.error", {
    log_id: id,
    fingerprint: event.fingerprint,
    severity: event.severity,
    module: event.module,
    operation: event.operation,
    error_code: event.errorCode ?? null,
    country: event.country ?? null,
    provider: event.provider ?? null,
    http_status: event.httpStatus ?? null,
    occurrence_count: occurrenceCount,
    stored,
  });

  return { id, fingerprint: event.fingerprint, occurrenceCount, stored };
}
