// Vercel serverless entrypoint for every /api/* route.
//
// The Express app is imported LAZILY inside the handler (not as a top-level
// `import { app }`) so that any initialization failure is caught and returned
// as a readable JSON 500 — instead of collapsing into an opaque
// FUNCTION_INVOCATION_FAILED that takes down every route with no clue why.
// Wrapping the app in an explicit (req, res) handler is also the shape
// @vercel/node expects; a bare Express-app default export can fail to be
// invoked under "type": "module".
import type { IncomingMessage, ServerResponse } from "http";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedApp: NodeHandler | null = null;
let initError: unknown = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedApp && !initError) {
    try {
      const mod = await import("../server");
      cachedApp = mod.app as unknown as NodeHandler;
    } catch (error) {
      initError = error;
      console.error("[api] Server initialization failed:", error);
    }
  }

  if (initError) {
    // Use raw Node res methods here: if init failed there is no Express app to
    // provide res.status()/res.json().
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Server initialization failed",
        detail:
          initError instanceof Error
            ? initError.stack || initError.message
            : String(initError),
      }),
    );
    return;
  }

  cachedApp!(req, res);
}
