import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  projects: [
    { name: "production", use: { baseURL: "http://127.0.0.1:4173" } },
    { name: "development", use: { baseURL: "http://127.0.0.1:4174" } },
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm run build && pnpm start",
      env: { PORT: "4173" },
      url: "http://127.0.0.1:4173/api/v1/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @hydraw/web exec vp dev --host 127.0.0.1 --port 4174",
      env: { HYDRAW_API_TARGET: "http://127.0.0.1:4173" },
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
