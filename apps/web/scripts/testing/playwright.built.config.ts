import { defineConfig } from "@playwright/test";
import { projectRoot } from "./process.mjs";

export default defineConfig({
  testDir: "../../tests/built",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101", browserName: "chromium", channel: "msedge",
    trace: "off", screenshot: "off", video: "off", serviceWorkers: "block",
  },
  webServer: {
    command: "node scripts/testing/built-server.mjs",
    cwd: projectRoot,
    url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 180_000,
  },
});
