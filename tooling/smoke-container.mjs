import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const image = "hydraw:smoke";
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
execFileSync("docker", ["build", "-t", image, "."], { stdio: "inherit" });
const container = docker("run", "--detach", "-p", "127.0.0.1::3000", image);
try {
  const port = docker(
    "inspect",
    "--format",
    '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}',
    container,
  );
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${origin}/api/v1/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Container startup is asynchronous. */
    }
    await setTimeout(250);
  }
  assert(ready, "The packaged application did not become ready.");
  assert.notEqual(
    docker("exec", container, "id", "-u"),
    "0",
    "Runtime should run as a non-root user.",
  );
  const missing = await fetch(`${origin}/api/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "NOT_FOUND" });
  for (const path of ["/", "/board/local.with.dots"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>Hydraw/);
  }
  const html = await (await fetch(origin)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)];
  assert(assets.length >= 2, "Expected built JavaScript and CSS assets.");
  for (const [, path] of assets) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    assert((await response.text()).length > 0);
  }
  console.log("Docker smoke passed: API, React routes, built assets and non-root runtime.");
} catch (error) {
  console.error(docker("logs", container));
  throw error;
} finally {
  docker("rm", "--force", container);
}
