import { defineConfig } from "@playwright/test";
import { localEnvironment, localOrigins } from "./scripts/testing/environment.mjs";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/browser",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/browser", open: "never" }]],
  use: {
    baseURL: localOrigins.browser,
    browserName: "chromium",
    channel: "msedge",
    serviceWorkers: "block",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/testing/serve.mjs browser",
    url: `${localOrigins.browser}/api/session`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: localEnvironment({ lane: "browser" }),
  },
});
