import { spawn } from "node:child_process";

const children = [
  spawn("pnpm", ["--filter", "@hydraw/server", "run", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@hydraw/web", "run", "dev"], { stdio: "inherit" }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
  process.exitCode = code;
}
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
});
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
