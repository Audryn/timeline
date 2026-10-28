import {
  checkAxe, checkReflow, conflict, expect, longNotes, longTitle, openEditor, openTimeline,
  qualityEvent, qualityWorkspace, test, title,
} from "./fixtures";

test("axe checks loaded welcome and labeled account form", async ({ page, context }, testInfo) => {
  await context.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: null } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Every life has a story." })).toBeVisible();
  await checkAxe(page, testInfo, "welcome");
  await page.getByRole("link", { name: "Create your account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await checkAxe(page, testInfo, "account-loaded");
});

test("keyboard skip link, labeled form and rejected submit retain visible focus", async ({ page, context }, testInfo) => {
  await context.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: null } }));
  await context.route("**/api/auth/signup", (route) => route.fulfill({
    status: 503, json: { error: "Synthetic account service is temporarily unavailable." },
  }));
  await page.goto("/account?mode=signup");
  const submit = page.getByRole("button", { name: "Create account", exact: true });
  await expect(submit).toBeEnabled();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await expect(skip).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Back to Timeline", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password", { exact: true });
  await expect(email).toBeFocused();
  await page.keyboard.type("quality@example.invalid");
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.type("synthetic quality passphrase");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  const error = page.getByRole("alert").filter({ hasText: "Synthetic account service is temporarily unavailable." });
  await expect(error).toBeVisible();
  await expect.poll(() => error.evaluate((node) => document.activeElement?.contains(node))).toBe(true);
  await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await checkAxe(page, testInfo, "account-error");
});

test("axe checks a loaded empty timeline and its filter controls", async ({ context, page }, testInfo) => {
  await qualityWorkspace(context, []);
  await openTimeline(page);
  await expect(page.getByRole("heading", { name: "Your story can start anywhere." })).toBeVisible();
  await expect(page.getByLabel("Search memories")).toBeEnabled();
  await expect(page.getByRole("listbox", { name: "People", exact: true })).toBeEnabled();
  await checkAxe(page, testInfo, "empty-timeline");
});

test("axe checks populated timeline, editor and preserved conflict", async ({ context, page }, testInfo) => {
  await qualityWorkspace(context);
  await conflict(context);
  await openTimeline(page);
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await checkAxe(page, testInfo, "populated-timeline");
  await openEditor(page, title);
  await expect.soft(page.getByLabel("What happened?")).toBeFocused();
  await checkAxe(page, testInfo, "editor");
  await page.getByLabel("What happened?").fill("QA — My preserved fictional revision");
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Current account version" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "This fictional event changed elsewhere." })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("QA — My preserved fictional revision");
  await expect(page.getByRole("button", { name: "Keep my draft and use this base version" })).toBeEnabled();
  await checkAxe(page, testInfo, "editor-conflict");
});

test("390px long-content timeline and editor reflow without clipped actions", async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await qualityWorkspace(context, [qualityEvent(1, true)], true);
  await openTimeline(page);
  await expect(page.getByText(longNotes, { exact: true })).toBeVisible();
  await checkReflow(page, [
    page.getByRole("button", { name: longTitle, exact: true }),
    page.getByRole("button", { name: "Apply filters", exact: true }),
    page.getByRole("button", { name: "+ Add event / recover new draft", exact: true }),
  ]);
  await openEditor(page, longTitle);
  await expect(page.getByLabel("Notes (optional)")).toHaveValue(longNotes);
  await checkReflow(page, [
    page.getByLabel("What happened?"),
    page.getByLabel("Notes (optional)"),
    page.getByRole("button", { name: "Close editor", exact: true }),
    page.getByRole("button", { name: "Save event to account", exact: true }),
    page.getByRole("button", { name: "Download draft copy", exact: true }),
  ]);
  await checkAxe(page, testInfo, "mobile-editor-navigation");
});

test("200% viewport-equivalent reflow and separate doubled text preserve editor actions", async ({ context, page }, testInfo) => {
  await qualityWorkspace(context);
  // Half a 1280x960 CSS viewport models layout reflow, not native browser zoom.
  await page.setViewportSize({ width: 640, height: 480 });
  await openTimeline(page);
  await checkReflow(page, [
    page.getByRole("button", { name: title, exact: true }),
    page.getByRole("button", { name: "Apply filters", exact: true }),
  ]);
  await openEditor(page, title);
  const actions = [
    page.getByLabel("What happened?"),
    page.getByRole("button", { name: "Save event to account", exact: true }),
    page.getByRole("button", { name: "Close editor", exact: true }),
  ];
  await checkReflow(page, actions);
  await page.setViewportSize({ width: 1280, height: 960 });
  const fontSizes = await page.getByLabel("What happened?").evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  await page.evaluate(() => {
    // Measure before changing ancestors, so descendants are enlarged once only.
    const sizes = Array.from(document.querySelectorAll<HTMLElement>("body, body *"))
      .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
  });
  await expect(page.getByLabel("What happened?")).toHaveCSS("font-size", `${fontSizes * 2}px`);
  await checkReflow(page, actions);
  await testInfo.attach("reflow-scope", {
    body: "Synthetic Edge layout: 640x480 CSS viewport (1280x960 at 200% equivalent), then separately doubled computed text at 1280x960. Not native zoom, mobile-device, screen-reader, or WCAG certification.",
    contentType: "text/plain",
  });
});
