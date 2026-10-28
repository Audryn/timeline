import { expect, test } from "./fixtures/test";
import { detail, draftFault, openNew, project, storedDrafts, workspace } from "./fixtures/workspace";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile navigation uses real routes, current-page links and reachable touch targets", async ({ page, context }) => {
  await workspace(context);
  await context.route("**/api/projects", (route) => route.fulfill({ json: [detail.project] }));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  for (const link of await nav.getByRole("link").all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(nav.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account\?mode=signin$/);
  await expect(nav.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastLink = await page.getByRole("link", { name: "Resend a confirmation email", exact: true }).boundingBox();
  const bar = await nav.boundingBox();
  expect(lastLink && bar && lastLink.y + lastLink.height <= bar.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile and header navigation require an explicit successful draft flush", async ({ page, context }) => {
  const state = await workspace(context);
  await page.clock.install({ time: new Date("2026-10-20T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T12:00:01Z"));
  await page.goto(`/projects/${project}`);
  await openNew(page);
  await page.getByLabel("What happened?").fill("Latest text before the autosave delay");
  const home = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Home", exact: true });
  await home.click();
  const warning = page.getByRole("alert").filter({ hasText: "Close the editor to save its draft before navigating." });
  await expect(warning).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${project}$`));
  await page.getByRole("link", { name: "Timeline home", exact: true }).click();
  await expect(page.getByLabel("What happened?")).toHaveValue("Latest text before the autosave delay");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(page.getByLabel("What happened?")).toHaveCount(0);
  expect((await storedDrafts(page)).map((draft) => draft.form.title)).toEqual(["Latest text before the autosave delay"]);
  await home.click();
  await expect(page).toHaveURL(/\/$/);
  expect(state.attempts).toHaveLength(0);
});

test("failed draft storage never turns a navigation request into lost text or publication", async ({ page, context }) => {
  const state = await workspace(context);
  await draftFault(context, "write");
  await page.goto(`/projects/${project}`);
  await openNew(page);
  await page.getByLabel("What happened?").fill("Recover this text before leaving");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic draft write failure." })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Account", exact: true }).click();
  const warning = page.getByRole("alert").filter({ hasText: "If storage fails, download a copy before leaving." });
  await expect(warning).toBeVisible();
  await expect(warning).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/projects/${project}$`));
  await expect(page.getByLabel("What happened?")).toHaveValue("Recover this text before leaving");
  await expect(page.getByRole("button", { name: "Download draft copy", exact: true })).toBeEnabled();
  expect(state.attempts).toHaveLength(0);
  expect(await storedDrafts(page)).toHaveLength(0);
});
