import { expect, openTimeline, qualityEvent, qualityWorkspace, test } from "./fixtures";

test("records an informational sanitized synthetic browser performance sample", async ({ browser, context, page }, testInfo) => {
  await qualityWorkspace(context, Array.from({ length: 50 }, (_, index) => qualityEvent(index + 1)));
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  const start = performance.now();
  await openTimeline(page);
  await expect(page.getByRole("button", { name: "QA — Fictional chapter 50", exact: true })).toBeVisible();
  const sample = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByName("first-contentful-paint", "paint")[0];
    return {
      responseEndMs: navigation?.responseEnd ?? null,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      firstContentfulPaintMs: paint?.startTime ?? null,
      resourceCount: performance.getEntriesByType("resource").length,
      renderedEventCount: document.querySelectorAll("article").length,
    };
  });
  const { metrics } = await session.send("Performance.getMetrics");
  const allowed = new Set(["JSHeapUsedSize", "Nodes", "Documents", "ScriptDuration", "LayoutDuration", "TaskDuration"]);
  const browserMetrics = Object.fromEntries(metrics.filter(({ name }) => allowed.has(name)).map(({ name, value }) => [name, value]));
  await session.detach();
  await testInfo.attach("synthetic-development-performance.json", {
    body: JSON.stringify({
      scope: "Informational local Next development sample with 50 synthetic events and mocked UI APIs; not a production budget or field Web Vitals evidence.",
      browser: `Microsoft Edge ${browser.version()}`,
      viewport: page.viewportSize(),
      navigationToRenderedFixtureMs: performance.now() - start,
      ...sample,
      browserMetrics,
    }, null, 2),
    contentType: "application/json",
  });
  expect(sample.renderedEventCount).toBe(50);
});
