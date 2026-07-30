/**
 * Request origin derivation that never touches Express's `req.protocol` or
 * `req.get()`.
 *
 * On Vercel those accessors run through a platform shim that still calls the
 * deprecated `url.parse()`, so every request that built an absolute URL logged
 * a DEP0169 security warning. The forwarded headers read here are what the
 * proxy sets anyway.
 *
 * The parameter type is deliberately structural rather than `express.Request`:
 * it documents at the type level that only headers and the socket are read, and
 * lets the behaviour be tested without booting the server.
 */
export type OriginRequest = {
  headers: NodeJS.Dict<string | string[]>;
  socket?: unknown;
};

/** TLSSocket sets `encrypted`; a plain net.Socket has no such property. */
function isEncrypted(socket: unknown): boolean {
  return (
    typeof socket === "object" &&
    socket !== null &&
    (socket as { encrypted?: unknown }).encrypted === true
  );
}

/** A comma-separated forwarded header means several proxies appended to it;
 *  the left-most entry is the original client. */
function firstValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || "";
}

/**
 * "https://rail-national.vercel.app", or "" when the request carries no host
 * at all — callers fall back to APP_URL rather than emit "https://undefined".
 */
export function requestOrigin(req: OriginRequest): string {
  const host = firstValue(req.headers["x-forwarded-host"]) || firstValue(req.headers.host);
  if (!host) return "";
  const proto =
    firstValue(req.headers["x-forwarded-proto"]) || (isEncrypted(req.socket) ? "https" : "http");
  return `${proto}://${host}`;
}
