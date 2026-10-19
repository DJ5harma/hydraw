import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { api } from "./routes/api.ts";

/** One application: backend under /api, built React everywhere else. */
export function createApp(webRoot: string) {
  const app = new Hono();
  app.route("/api", api);
  app.get("*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
  return app;
}
