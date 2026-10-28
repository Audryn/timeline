import { expect, openTimeline, qualityWorkspace, test, title } from "./fixtures";

test("reviewed synthetic populated timeline visual baseline", async ({ browser, context, page }, testInfo) => {
  testInfo.snapshotSuffix = `${process.platform}-msedge-${browser.version()}`;
  await qualityWorkspace(context);
  await openTimeline(page);
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("region", { name: "Project timeline" }))
    .toHaveScreenshot("populated-timeline-desktop.png");
});
