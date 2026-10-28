import { expect, test } from "./fixtures/test";
import { category, detail, owner, person, project } from "./fixtures/workspace";

test("unconfigured accounts are honestly blocked, with readable setup steps", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { configured: false, user: null } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByText("Supabase has not been configured yet.")).toBeVisible();
  await page.getByRole("link", { name: "Open setup instructions" }).click();
  await expect(page.getByRole("heading", { name: "Connect your private workspace." })).toBeVisible();
  await page.goto("/account?mode=signup");
  await expect(page.getByRole("button", { name: /create.*account/i })).toBeDisabled();
});

test("real API rejects foreign origins and does not invent an account when unconfigured", async ({ request, baseURL }) => {
  const csrf = await request.post("/api/auth/signup", {
    headers: { Origin: "https://not-timeline.example" },
    data: { email: "test@example.com", password: "long-enough-password" },
  });
  expect(csrf.status()).toBe(403);
  const session = await request.get("/api/session");
  expect(session.headers()["cache-control"]).toContain("no-store");
  expect(session.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const result = await session.json();
  expect(result).toEqual({ configured: false, user: null });
  const signup = await request.post("/api/auth/signup", {
    headers: { Origin: new URL(baseURL!).origin },
    data: { email: "test@example.com", password: "long-enough-password" },
  });
  expect(signup.status()).toBe(503);
  expect(await signup.json()).toHaveProperty("error");
});

test("first-use project and season event are saved only after acknowledgment", async ({ page }) => {
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: { id: owner, email: "alex@example.com" } } }));
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON();
      expect(data.personName).toBe("Alex");
      expect(data.name).toBe("My life");
      await route.fulfill({ json: { id: project } });
    } else await route.fulfill({ json: [] });
  });
  await page.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: detail }));
  await page.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      expect(saved).toMatchObject({
        title: "Started at Northfield School", personIds: [person], categoryIds: [category],
        date: { kind: "season", year: 2005, season: "autumn", approximate: false },
      });
      await route.fulfill({ json: { id: saved!.id, version: 1 } });
    } else {
      const input: Record<string, unknown> | null = saved;
      await route.fulfill({ json: { hasMore: false, events: input ? [{
        id: input.id, project_id: project, version: 1, title: input.title,
        description: input.description, location: input.location, date: input.date,
        person_ids: input.personIds, category_ids: input.categoryIds,
        start_date: "2005-09-01", end_date: "2005-11-30",
      }] : [] } });
    }
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("First person or character's name").fill("Alex");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My life", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await page.getByLabel("What happened?").fill("Started at Northfield School");
  await page.getByRole("checkbox", { name: "Education", exact: true }).check();
  await page.getByLabel("Date type").selectOption("season");
  await page.getByLabel("Season starting year").fill("2005");
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Started at Northfield School", exact: true })).toBeVisible();
  await expect(page.getByText("Autumn 2005", { exact: false })).toBeVisible();
});

test("browser draft survives navigation and failed saves never publish it", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: { id: owner, email: "alex@example.com" } } }));
  await page.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: detail }));
  await page.route(`**/api/projects/${project}/events**`, async (route) => {
    await route.fulfill(route.request().method() === "POST"
      ? { status: 503, json: { error: "Connection failed." } }
      : { json: { events: [], hasMore: false } });
  });
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await page.getByLabel("What happened?").fill("A recoverable memory");
  await expect(page.getByRole("status").filter({ hasText: "Draft saved on this browser." })).toBeVisible();
  await page.getByRole("button", { name: "Close editor" }).click();
  await page.reload();
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await expect(page.getByLabel("What happened?")).toHaveValue("A recoverable memory");
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Connection failed." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry unconfirmed save" })).toBeEnabled();
  await expect(page.getByLabel("What happened?")).toBeDisabled();
  await expect(page.getByText("Your event is saved to your account.")).toHaveCount(0);
});

test("welcome and setup fit a narrow screen without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/setup", "/account?mode=signin"]) {
    await page.route("**/api/session", (route) => route.fulfill({ json: { configured: false, user: null } }));
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("an unconfirmed save retries the identical request and clears the draft only on success", async ({ page }) => {
  const attempts: unknown[] = [];
  await page.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: { id: owner, email: "alex@example.com" } } }));
  await page.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: detail }));
  await page.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { events: [], hasMore: false } });
    const input = route.request().postDataJSON();
    attempts.push(input);
    return route.fulfill(attempts.length === 1
      ? { status: 503, json: { error: "Acknowledgment lost." } }
      : { json: { id: input.id, version: 1 } });
  });
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await page.getByLabel("What happened?").fill("An uncertain save");
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("button", { name: "Retry unconfirmed save" })).toBeEnabled();
  await page.getByRole("button", { name: "Retry unconfirmed save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await expect(page.getByLabel("What happened?")).toHaveValue("");
});

test("a stale edit preserves its draft and requires an explicit current base version", async ({ page }) => {
  const eventId = "50000000-0000-4000-8000-000000000001";
  const original = {
    id: eventId, project_id: project, title: "Original memory", description: "", location: "",
    date: { kind: "unknown" }, version: 1, person_ids: [person], category_ids: [],
    start_date: null, end_date: null,
  };
  const attempts: { version: number; title: string }[] = [];
  await page.route("**/api/session", (route) => route.fulfill({ json: { configured: true, user: { id: owner, email: "alex@example.com" } } }));
  await page.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: detail }));
  await page.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON(); attempts.push(input);
      return route.fulfill(attempts.length === 1
        ? { status: 409, json: { error: "This event changed elsewhere. Your draft has been kept." } }
        : { json: { id: eventId, version: 3 } });
    }
    const current = new URL(route.request().url()).searchParams.has("event");
    return route.fulfill({ json: { events: [{ ...original, ...(current ? { title: "Changed on another device", version: 2 } : {}) }], hasMore: false } });
  });
  await page.goto(`/projects/${project}`);
  await page.getByLabel("Search memories").fill("memory");
  await page.getByRole("listbox", { name: "People", exact: true }).selectOption(person);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("button", { name: "Original memory", exact: true }).click();
  await page.getByLabel("What happened?").fill("My preserved draft");
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("heading", { name: "Current account version" })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("My preserved draft");
  await expect(page.getByText("Changed on another device", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep my draft and use this base version" }).click();
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  expect(attempts.map((attempt) => attempt.version)).toEqual([1, 2]);
  expect(attempts.every((attempt) => attempt.title === "My preserved draft")).toBe(true);
  await expect(page.getByLabel("Search memories")).toHaveValue("memory");
  await expect(page.getByRole("listbox", { name: "People", exact: true })).toHaveValues([person]);
});

test("sign-out in another tab cannot discard an active editor's draft", async ({ page, context }) => {
  let signouts = 0;
  let signedIn = true;
  await context.route("**/api/session", (route) => route.fulfill({ json: {
    configured: true, user: signedIn ? { id: owner, email: "alex@example.com" } : null,
  } }));
  await context.route(`**/api/projects/${project}`, (route) => route.fulfill({ json: detail }));
  await context.route(`**/api/projects/${project}/events**`, (route) => route.fulfill({ json: { events: [], hasMore: false } }));
  await context.route("**/api/auth/signout", (route) => {
    signouts += 1; signedIn = false;
    return route.fulfill({ json: { message: "Signed out." } });
  });
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await page.getByLabel("What happened?").fill("An active memory");
  const other = await context.newPage();
  await other.goto(`/projects/${project}`);
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(other.getByRole("alert").filter({ hasText: "Another tab has an open event editor." })).toBeVisible();
  expect(signouts).toBe(0);
  await expect(page.getByLabel("What happened?")).toHaveValue("An active memory");
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.getByLabel("What happened?")).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held?.length ?? 0)).toBe(0);
  other.once("dialog", (dialog) => dialog.accept());
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(other).toHaveURL(/\/account\?mode=signin$/);
  expect(signouts).toBe(1);
});
