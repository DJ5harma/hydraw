import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"] },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
