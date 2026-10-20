import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { createApp } from "./app.ts";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "hydraw-routing-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>Hydraw</title>");
  await writeFile(join(root, "assets", "app-abc.js"), 'console.log("hydraw")');
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it("mounts backend routes under /api and the built frontend everywhere else", async () => {
  const app = createApp(root);
  const home = await app.request("/board/local");
  expect(home.status).toBe(200);
  expect(await home.text()).toContain("<title>Hydraw</title>");
  const api = await app.request("/api/v1/missing");
  expect(api.status).toBe(404);
  expect(await api.json()).toEqual({ error: "NOT_FOUND" });
  for (const path of ["/api", "/api/", "/api/missing", "/api/v1/missing"]) {
    const missing = await app.request(path);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "NOT_FOUND" });
  }
  for (const path of ["/board/project.with.dots", "/apiculture", "/settings/profile"]) {
    expect(await (await app.request(path)).text()).toContain("<title>Hydraw</title>");
  }
  const asset = await app.request("/assets/app-abc.js");
  expect(asset.status).toBe(200);
  expect(await asset.text()).toBe('console.log("hydraw")');
  expect(await (await app.request("/api/v1/health")).json()).toEqual({
    status: "ok",
    service: "hydraw",
  });
});

it("returns 404 for missing built assets while retaining dotted application routes", async () => {
  const app = createApp(root);
  for (const path of ["/assets", "/assets/old-build.js", "/assets/old-build.css"]) {
    const response = await app.request(path);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("<title>Hydraw</title>");
    const head = await app.request(path, { method: "HEAD" });
    expect(head.status).toBe(404);
    expect(await head.text()).toBe("");
  }
  const asset = await app.request("/assets/app-abc.js", { method: "HEAD" });
  expect(asset.status).toBe(200);
  expect(await asset.text()).toBe("");
  const navigation = await app.request("/board/architecture.v2", { method: "HEAD" });
  expect(navigation.status).toBe(200);
});
