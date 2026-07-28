import { createServer, IncomingMessage, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";

const activeServers: Server[] = [];

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  delete (IncomingMessage.prototype as IncomingMessage & { query?: unknown }).query;
});

describe("Express on platform IncomingMessage", () => {
  it("does not read a platform-provided legacy req.query getter", async () => {
    Object.defineProperty(IncomingMessage.prototype, "query", {
      configurable: true,
      get() {
        throw new Error("platform legacy req.query getter was accessed");
      },
    });

    const app = express();
    app.get("/probe", (req, res) => {
      res.json({ hasQuery: typeof req.query === "object" });
    });

    const server = createServer(app);
    activeServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected an ephemeral TCP server address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/probe`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasQuery: true });
  });
});
