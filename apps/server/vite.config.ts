import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: "esm",
    platform: "node",
    outDir: "dist",
    dts: false,
    deps: {
      alwaysBundle: [/^hono(?:\/|$)/, /^@hono\/node-server(?:\/|$)/],
      onlyBundle: ["hono", "@hono/node-server"],
    },
  },
});
