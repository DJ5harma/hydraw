import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { api } from "./routes/api.ts";

/** One application: backend under /api, built React everywhere else. */
export function createApp(webRoot: string) {
  const app = new Hono();
  app.route("/api", api);
  app.get("*", serveStatic({ root: webRoot }));
  // Only application navigation gets the SPA fallback. A stale asset URL must fail.
  app.get("/assets", (c) => c.notFound());
  app.get("/assets/*", (c) => c.notFound());
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
  return app;
}
