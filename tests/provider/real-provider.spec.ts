import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { captureLink, localProviderOrigin } from "../../scripts/testing/provider-policy.mjs";

const app = "http://127.0.0.1:3100";
const mail = localProviderOrigin(process.env.TIMELINE_PROVIDER_MAIL_ORIGIN ?? "");
const api = localProviderOrigin(process.env.SUPABASE_URL ?? "");
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;

async function post(request: APIRequestContext, path: string, data: unknown) {
  return request.post(path, { headers: { Origin: app }, data });
}
async function waitForLink(request: APIRequestContext, recipient: string, type: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const listing = await request.get(`${mail}/api/v1/messages`);
    if (!listing.ok()) throw new Error("Private Mailpit capture is unavailable.");
    const data = await listing.json();
    for (const message of data.messages ?? []) {
      if (!(message.To ?? []).some((to: { Address?: string }) => to.Address === recipient)) continue;
      const result = await request.get(`${mail}/api/v1/message/${encodeURIComponent(message.ID)}`);
      if (!result.ok()) throw new Error("Captured synthetic message unavailable.");
      const body = await result.json();
      try { return captureLink(`${body.HTML ?? ""}\n${body.Text ?? ""}`, app, type); }
      catch { /* A previous confirmation message is not a recovery message. */ }
    }
    await setTimeout(200);
  }
  throw new Error("Expected synthetic mail was not captured; no real inbox was used.");
}
async function register(page: Page, email: string, password: string) {
  const signup = await post(page.request, "/api/auth/signup", { email, password });
  if (!signup.ok()) throw new Error("Synthetic signup rejected.");
  const link = await waitForLink(page.request, email, "signup");
  try { await page.goto(link); } catch { throw new Error("Synthetic confirmation callback navigation failed."); }
  await expect(page.getByRole("heading", { name: "Your projects", exact: true })).toBeVisible();
}

test("real captured signup/reset, atomic events, PostgREST filters, isolation, replay and versions", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const email = `owner-a-${randomUUID()}@example.invalid`;
  const password = `Fixture-${randomUUID()}`;
  const secondPassword = `Updated-${randomUUID()}`;
  await register(page, email, password);
  const session = await page.request.get("/api/session");
  const owner = (await session.json()).user?.id;
  expect(typeof owner).toBe("string");

  const input = {
    requestId: randomUUID(), name: "QA disposable provider", personName: "Alex Synthetic",
    personKind: "real", hemisphere: "northern",
  };
  const create = await post(page.request, "/api/projects", input);
  expect(create.status()).toBe(200);
  const { id: project } = await create.json();
  const detail = await (await page.request.get(`/api/projects/${project}`)).json();
  const event = {
    id: randomUUID(), requestId: randomUUID(), version: 0,
    title: '100%_complete, "school"', description: "Synthetic only", location: "",
    personIds: [detail.people[0].id], categoryIds: [detail.categories[0].id],
    date: { kind: "season", season: "autumn", year: 2005, approximate: false },
  };
  expect((await post(page.request, `/api/projects/${project}/events`, event)).status()).toBe(200);
  const replay = await post(page.request, `/api/projects/${project}/events`, event);
  expect((await replay.json()).version).toBe(1);
  for (const [q, expected] of [['100%_complete, "school"', 1], ["not a match", 0]] as const) {
    const filter = new URLSearchParams({ q, from: "2005-09-01", to: "2005-11-30", undated: "false", person: detail.people[0].id });
    const result = await page.request.get(`/api/projects/${project}/events?${filter}`);
    expect(result.status()).toBe(200);
    const records = (await result.json()).events;
    expect(records.length).toBe(expected);
    if (expected) expect(records[0].id).toBe(event.id);
  }
  const edited = { ...event, version: 1, requestId: randomUUID(), title: "Current synthetic version" };
  expect((await post(page.request, `/api/projects/${project}/events`, edited)).status()).toBe(200);
  expect((await post(page.request, `/api/projects/${project}/events`, { ...event, version: 1, requestId: randomUUID() })).status()).toBe(409);

  let droppedEventId = "";
  const eventRoute = `**/api/projects/${project}/events*`;
  await page.route(eventRoute, async (route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    const input = route.request().postDataJSON();
    const committed = await route.fetch();
    if (!committed.ok()) {
      await route.fulfill({ status: 500, json: { error: "Synthetic upstream mutation failed." } });
      return;
    }
    droppedEventId = input.id;
    await route.abort();
  });
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "+ Add event / recover new draft" }).click();
  await page.getByLabel("What happened?").fill("QA real committed acknowledgment loss");
  await page.getByRole("button", { name: "Save event to account" }).click();
  await expect(page.getByRole("button", { name: "Retry unconfirmed save" })).toBeEnabled();
  if (!droppedEventId) throw new Error("The fault did not reach a successful real commit.");
  await page.unroute(eventRoute);
  await page.getByRole("button", { name: "Retry unconfirmed save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  const afterRetry = await (await page.request.get(`/api/projects/${project}/events?undated=true`)).json();
  const replayed = afterRetry.events.filter((record: { id: string }) => record.id === droppedEventId);
  expect(replayed.length).toBe(1);
  expect(replayed[0].version).toBe(1);

  const other = await browser.newContext({ baseURL: app, serviceWorkers: "block" });
  try {
    const otherPage = await other.newPage();
    await register(otherPage, `owner-b-${randomUUID()}@example.invalid`, `Fixture-${randomUUID()}`);
    expect((await other.request.get(`/api/projects/${project}`)).status()).toBe(404);
    const denied = await post(other.request, `/api/projects/${project}/events`, { ...event, id: randomUUID(), requestId: randomUUID() });
    expect(denied.status()).toBe(403);
  } finally { await other.close(); }

  const reset = await post(page.request, "/api/auth/reset", { email });
  expect(reset.status()).toBe(200);
  const recovery = await waitForLink(page.request, email, "recovery");
  try { await page.goto(recovery); } catch { throw new Error("Synthetic recovery callback navigation failed."); }
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect((await post(page.request, "/api/auth/password", { password: secondPassword })).status()).toBe(200);
  expect((await post(page.request, "/api/auth/signout", {})).status()).toBe(200);
  expect((await post(page.request, "/api/auth/signin", { email, password })).status()).toBe(400);
  expect((await post(page.request, "/api/auth/signin", { email, password: secondPassword })).status()).toBe(200);
  const finalSession = await (await page.request.get("/api/session")).json();
  expect(finalSession.user.id).toBe(owner);

  const clientSession = await page.context().cookies();
  expect(clientSession.some((cookie) => cookie.httpOnly)).toBe(true);
  if (!publicKey) throw new Error("Disposable stack public key missing.");
  const tokenResult = await page.request.post(`${api}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publicKey }, data: { email, password: secondPassword },
  });
  if (!tokenResult.ok()) throw new Error("Supplemental Data API session unavailable.");
  const token = (await tokenResult.json()).access_token;
  const direct = await page.request.post(`${api}/rest/v1/event_records`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
    data: { id: randomUUID(), project_id: project, title: "Direct write must be denied", description: "", location: "", date: { kind: "unknown" } },
  });
  expect([401, 403]).toContain(direct.status());
});
