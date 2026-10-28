import { expect, test } from "./fixtures/test";
import {
  clearDraftFault, draftFault, openNew, otherOwner, owner, project, storedDrafts, workspace,
} from "./fixtures/workspace";

const now = new Date("2026-10-20T12:00:00Z");
const localSaved = "Draft saved on this browser. Not yet saved to your account.";

test("a stale local draft in concurrent tabs cannot overwrite the winning browser revision", async ({ page, context }) => {
  const state = await workspace(context);
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await tab.goto(`/projects/${project}`);
    await tab.clock.install({ time: now });
    await tab.clock.pauseAt(new Date(now.getTime() + 1000));
    await openNew(tab);
  }
  await page.getByLabel("What happened?").fill("Winning local draft");
  await page.clock.runFor(401);
  await expect(page.getByRole("status").filter({ hasText: localSaved })).toBeVisible();
  await other.getByLabel("What happened?").fill("Stale tab's recoverable text");
  await other.clock.runFor(401);
  await expect(other.getByRole("alert").filter({ hasText: "This draft changed in another tab." })).toBeVisible();
  await other.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(other.getByLabel("What happened?")).toHaveValue("Stale tab's recoverable text");
  const download = other.waitForEvent("download");
  await other.getByRole("button", { name: "Download draft copy" }).click();
  const recovery = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of recovery) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).form.title).toBe("Stale tab's recoverable text");
  expect(state.attempts).toHaveLength(0);
  expect((await storedDrafts(page)).map((draft) => draft.form.title)).toEqual(["Winning local draft"]);
  await page.getByRole("button", { name: "Close editor" }).click();
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("Winning local draft");
});

test("IndexedDB open failure blocks editing honestly and can be retried after storage recovers", async ({ page, context }) => {
  const state = await workspace(context);
  await draftFault(context, "open");
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "+ Add event / recover new draft", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not open recoverable draft storage." })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveCount(0);
  expect(state.attempts).toHaveLength(0);
  await clearDraftFault(page);
  await page.getByRole("button", { name: "Retry loading", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not open recoverable draft storage." })).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add event / recover new draft", exact: true }).click();
  await expect(page.getByLabel("What happened?")).toBeVisible();
  await expect(page.getByLabel("What happened?")).toBeEnabled();
  await page.getByLabel("What happened?").fill("Storage is available again");
  await page.getByRole("button", { name: "Close editor" }).click();
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("Storage is available again");
});

test("a failed IndexedDB write retains visible text and prevents account submission until recovered", async ({ page, context }) => {
  const state = await workspace(context);
  await draftFault(context, "write");
  await page.goto(`/projects/${project}`);
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await openNew(page);
  await page.getByLabel("What happened?").fill("Keep this unsaved text");
  await page.clock.runFor(401);
  await expect(page.getByRole("status").filter({ hasText: "Local draft storage failed. Download a copy before leaving." })).toBeVisible();
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic draft write failure." })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toBeEnabled();
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.getByLabel("What happened?")).toHaveValue("Keep this unsaved text");
  expect(state.attempts).toHaveLength(0);
  expect(await storedDrafts(page)).toHaveLength(0);
  await clearDraftFault(page);
  await page.getByRole("button", { name: "Close editor" }).click();
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("Keep this unsaved text");
});

test("acknowledged account save with IndexedDB delete failure retains an identical retry instead of claiming cleanup", async ({ page, context }) => {
  const state = await workspace(context);
  await draftFault(context, "delete");
  await page.goto(`/projects/${project}`);
  await openNew(page);
  await page.getByLabel("What happened?").fill("Acknowledged but not locally cleared");
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic draft delete failure." })).toBeVisible();
  expect(state.attempts).toHaveLength(1);
  expect(state.events).toHaveLength(1);
  await expect(page.getByText("Your event is saved to your account.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("What happened?")).toBeDisabled();
  expect((await storedDrafts(page))[0].pending).toEqual(state.attempts[0]);
  await clearDraftFault(page);
  await page.getByRole("button", { name: "Close editor" }).click();
  await openNew(page);
  await page.getByRole("button", { name: "Retry unconfirmed save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  expect(state.attempts).toHaveLength(2);
  expect(state.attempts[1]).toEqual(state.attempts[0]);
  expect(await storedDrafts(page)).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Acknowledged but not locally cleared", exact: true })).toHaveCount(1);
});

test("a lost response remains pending across editor close and reopen with the same request UUID and payload", async ({ page, context }) => {
  const state = await workspace(context);
  let dropped = false;
  await context.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() !== "POST" || dropped) return route.fallback();
    dropped = true;
    state.attempts.push(route.request().postDataJSON());
    await route.abort("connectionreset");
  });
  await page.goto(`/projects/${project}`);
  await openNew(page);
  await page.getByLabel("What happened?").fill("An explicitly retried memory");
  await page.getByLabel("Notes (optional)").fill("Fictional details\nwith a second line.");
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry unconfirmed save", exact: true })).toBeEnabled();
  const first = structuredClone(state.attempts[0]);
  expect(first.requestId).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  await page.getByRole("button", { name: "Close editor" }).click();
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue(first.title);
  await expect(page.getByLabel("Notes (optional)")).toHaveValue(first.description);
  await expect(page.getByLabel("What happened?")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Discard draft", exact: true })).toBeDisabled();
  expect(state.attempts).toHaveLength(1);
  expect((await storedDrafts(page))[0].pending).toEqual(first);
  await page.getByRole("button", { name: "Retry unconfirmed save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  expect(state.attempts).toEqual([first, first]);
  expect(await storedDrafts(page)).toHaveLength(0);
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("");
});

test("an account switch flushes the latest pre-debounce snapshot without exposing it to the next owner", async ({ page, context }) => {
  const state = await workspace(context);
  await page.goto(`/projects/${project}`);
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await openNew(page);
  await page.getByLabel("What happened?").fill("First owner's last keystrokes");
  await page.getByLabel("Notes (optional)").fill("Only owner A should recover this.");
  expect(await storedDrafts(page)).toHaveLength(0);
  state.user = { id: otherOwner, email: "other@example.com" };
  await page.evaluate(() => {
    const channel = new BroadcastChannel("timeline-account");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByText("other@example.com", { exact: true })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveCount(0);
  await expect(page.getByText("First owner's last keystrokes", { exact: true })).toHaveCount(0);
  expect((await storedDrafts(page)).map((draft) => ({
    owner: draft.owner, title: draft.form.title, description: draft.form.description,
  }))).toEqual([{ owner, title: "First owner's last keystrokes", description: "Only owner A should recover this." }]);
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("");
  await expect(page.getByLabel("Notes (optional)")).toHaveValue("");
  await page.getByLabel("What happened?").fill("A separate owner B draft");
  await page.getByRole("button", { name: "Close editor" }).click();
  state.user = { id: owner, email: "alex@example.com" };
  await page.evaluate(() => {
    const channel = new BroadcastChannel("timeline-account");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByText("alex@example.com", { exact: true })).toBeVisible();
  await openNew(page);
  await expect(page.getByLabel("What happened?")).toHaveValue("First owner's last keystrokes");
  expect((await storedDrafts(page)).map((draft) => draft.owner).sort()).toEqual([owner, otherOwner]);
  expect(state.attempts).toHaveLength(0);
});
