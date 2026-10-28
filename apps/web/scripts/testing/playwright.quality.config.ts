import { defineConfig } from "@playwright/test";
import { localEnvironment, localOrigins } from "./environment.mjs";
import { projectRoot } from "./process.mjs";

export default defineConfig({
  testDir: "../../tests/quality",
  outputDir: "../../test-results/quality",
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "../../playwright-report/quality", open: "never" }]],
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{snapshotSuffix}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0 },
  },
  use: {
    baseURL: localOrigins.quality,
    browserName: "chromium",
    channel: "msedge",
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/testing/serve.mjs browser",
    cwd: projectRoot,
    url: `${localOrigins.quality}/api/session`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: localEnvironment({ lane: "quality" }),
  },
});
