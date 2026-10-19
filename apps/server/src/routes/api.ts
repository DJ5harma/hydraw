import { Hono } from "hono";

export const api = new Hono()
  .get("/v1/health", (c) => c.json({ status: "ok", service: "hydraw" }))
  .all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));
