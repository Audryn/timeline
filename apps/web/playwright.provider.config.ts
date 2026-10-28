import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/provider",
  workers: 1, retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100", browserName: "chromium", channel: "msedge",
    trace: "off", screenshot: "off", video: "off", serviceWorkers: "block",
  },
  webServer: {
    command: "node scripts/testing/provider-server.mjs",
    url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 120_000,
  },
});
