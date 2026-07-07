import type { IncomingMessage, ServerResponse } from "http";

// Vercel serverless entrypoint for every /api/* route.
//
// It loads the PRE-BUILT, self-contained bundle `dist/server.cjs` (produced by
// `npm run build`) via an explicit-extension import — NOT `../server`.
//
// Why: @vercel/node transpiles this function per-file as native ESM
// ("type": "module") and does NOT bundle it, so an extensionless relative
// import such as `../server` is unresolvable by Node's ESM loader at runtime
// (ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server'), which crashed
// the entire function — taking down every /api route. dist/server.cjs is fully
// bundled (only node_modules stay external), so there is no further relative
// path for the loader to fail on. The import is dynamic + wrapped so any
// remaining failure returns a readable JSON 500 instead of an opaque
// FUNCTION_INVOCATION_FAILED.
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedApp: NodeHandler | null = null;

async function loadApp(): Promise<NodeHandler> {
  if (cachedApp) return cachedApp;
  // @ts-ignore - built at deploy time by `npm run build`; absent at typecheck time
  const mod = await import("../dist/server.cjs");
  const bundle = (mod as { default?: { app?: unknown } }).default ?? (mod as { app?: unknown });
  const app = ((bundle as { app?: unknown }).app ?? bundle) as NodeHandler;
  cachedApp = app;
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (error) {
    console.error("[api] Server initialization failed:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Server initialization failed",
        detail: error instanceof Error ? error.stack || error.message : String(error),
      }),
    );
  }
}
