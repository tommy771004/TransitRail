import type { IncomingMessage, ServerResponse } from "http";
import { app } from "../server";

// Vercel serverless entrypoint for every /api/* route.
//
// `app` MUST be imported STATICALLY. @vercel/node bundles the function as native
// ESM ("type": "module") and inlines static imports — but esbuild leaves a
// dynamic `await import("../server")` as an unresolved runtime specifier, so the
// lambda crashed with ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server'
// (taking down every /api route). A static import inlines server.ts into the
// bundle, so there is no runtime relative import to resolve.
//
// The app is wrapped in an explicit (req, res) handler — the shape @vercel/node
// invokes; a bare Express-app default export can fail to be called.
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    (app as unknown as NodeHandler)(req, res);
  } catch (error) {
    console.error("[api] Request dispatch failed:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Request dispatch failed",
        detail: error instanceof Error ? error.stack || error.message : String(error),
      }),
    );
  }
}
