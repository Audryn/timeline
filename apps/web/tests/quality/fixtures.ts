import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Locator, Page, TestInfo } from "@playwright/test";
import { expect, test } from "../e2e/fixtures/test";
import { category, detail, memory, project, workspace } from "../e2e/fixtures/workspace";

export { expect, test, project };

export const title = "QA — Arrival at the fictional glass harbor";
export const longTitle = `QA fictional journey ${"across the lantern archipelago ".repeat(5)}`.trim();
export const longNotes = `A fictional field note.\n${"Lanternharbor".repeat(45)}\n${"The imaginary crew followed the paper map. ".repeat(20)}`;

export function qualityEvent(index = 1, long = false) {
  return memory(index, {
    title: long ? longTitle : index === 1 ? title : `QA — Fictional chapter ${index}`,
    description: long ? longNotes : "A synthetic memory for automated design checks. No real history.",
    location: "Imaginary Glass Harbor",
    date: { kind: "season", year: 2005, season: "autumn", approximate: false },
    start_date: "2005-09-01",
    end_date: "2005-11-30",
    category_ids: [category],
  });
}

export async function qualityWorkspace(context: BrowserContext, events = [qualityEvent()], long = false) {
  const state = await workspace(context, events);
  state.user.email = "quality@example.invalid";
  await context.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: {
    ...detail,
    project: { ...detail.project, name: long ? `QA ${"FictionalHarbor".repeat(7)}` : "QA — Glass Harbor stories" },
    people: [{ ...detail.people[0], name: long ? `Rowan ${"Character".repeat(9)}` : "Rowan Character", kind: "fictional" }],
  } }));
  return state;
}

export async function openTimeline(page: Page) {
  await page.goto(`/projects/${project}`);
  await expect(page.getByRole("heading", { name: /QA.*(?:Glass Harbor stories|FictionalHarbor)/, level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading memories..." })).toHaveCount(0);
}

export async function openEditor(page: Page, eventTitle?: string) {
  await page.getByRole("button", {
    name: eventTitle ?? "+ Add event / recover new draft",
    exact: true,
  }).click();
  await expect(page.getByLabel("What happened?")).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved on this browser." })).toBeVisible();
}

export async function checkAxe(page: Page, testInfo: TestInfo, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const violations = results.violations.map(({ id, impact, description, helpUrl, nodes }) => ({
    id, impact, description, helpUrl,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  }));
  await testInfo.attach(`axe-${state}`, {
    body: JSON.stringify({ state, violations }, null, 2),
    contentType: "application/json",
  });
  expect.soft(violations, `Automated axe findings in ${state}; this is not WCAG certification.`).toEqual([]);
}

export async function checkReflow(page: Page, controls: Locator[]) {
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  if (geometry.document > geometry.viewport || geometry.body > geometry.viewport) {
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("main *"))
      .map((node) => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width }))
      .filter(({ width }) => width > innerWidth)
      .sort((a, b) => b.width - a.width).slice(0, 10));
    await test.info().attach("reflow-overflow", {
      body: JSON.stringify({ ...geometry, overflow }, null, 2),
      contentType: "application/json",
    });
  }
  expect(geometry.document, "Document must not need horizontal scrolling.").toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.body, "Body must not overflow the reflow viewport.").toBeLessThanOrEqual(geometry.viewport);
  for (const control of controls) {
    await expect(control).toBeVisible();
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box, "A named action must have a rendered box.").not.toBeNull();
    expect(box!.x, "Action must not be clipped on the left.").toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, "Action must not be clipped on the right.").toBeLessThanOrEqual(geometry.viewport);
  }
}

export async function conflict(context: BrowserContext) {
  await context.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 409, json: { error: "This fictional event changed elsewhere. Your draft has been kept." } });
    }
    if (!new URL(route.request().url()).searchParams.has("event")) return route.fallback();
    return route.fulfill({ json: {
      events: [{ ...qualityEvent(), version: 2, title: "QA — A newer fictional account version" }],
      hasMore: false,
    } });
  });
}
