import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid TCP port.");
const app = createApp(fileURLToPath(new URL("../../web/dist/", import.meta.url)));
const server = serve(
  { fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" },
  (info) => {
    console.log(`Hydraw is running at http://127.0.0.1:${info.port}`);
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
