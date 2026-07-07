const AUDIT_SESSION_STORAGE_KEY = "transitrail.auditSessionId";

export function getAuditSessionId() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const existing = window.sessionStorage.getItem(AUDIT_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(AUDIT_SESSION_STORAGE_KEY, created);
  return created;
}

export function resolveAuditTimezone(fallback = "") {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem("transitrail.timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
}

export function getAuditHeaders(language: string, timezone: string) {
  const headers: Record<string, string> = {};
  const sessionId = getAuditSessionId();

  if (sessionId) {
    headers["x-tr-session-id"] = sessionId;
  }
  if (language) {
    headers["x-tr-language"] = language;
  }
  if (timezone) {
    headers["x-tr-timezone"] = timezone;
  }
  if (typeof window !== "undefined") {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    headers["x-tr-screen-width"] = String(viewportWidth);
    headers["x-tr-screen-height"] = String(viewportHeight);
    headers["x-tr-device-type"] = viewportWidth < 768 ? "mobile" : viewportWidth < 1024 ? "tablet" : "desktop";
  }

  return headers;
}

export async function postAuditEvent(
  payload: Record<string, unknown>,
  options: { language?: string; timezone?: string } = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/transit/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuditHeaders(options.language ?? window.navigator.language ?? "", options.timezone ?? resolveAuditTimezone()),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Audit writes must never affect the primary UI flow.
  }
}