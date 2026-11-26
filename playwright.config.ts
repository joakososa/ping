import { defineConfig, devices } from "@playwright/test";

// Browser tests for the PWA (docs/specs/pwa.md). They run against e2e/worker.ts, a TEST-ONLY Worker that plays
// Cloudflare Access. PW_CHROME_PATH lets a machine without Playwright's own browser use an installed Chrome.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8788",
    ...devices["Pixel 7"],
    browserName: "chromium",
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node e2e/start-server.mjs",
    url: "http://localhost:8788/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
