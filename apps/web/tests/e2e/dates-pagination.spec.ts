import type { Page } from "@playwright/test";
import type { LifeEvent } from "../../src/domain/models";
import { expect, test } from "./fixtures/test";
import { category, memory, person, project, workspace } from "./fixtures/workspace";

async function saveRoundTrip(page: Page, title: string) {
  await page.getByLabel("Notes (optional)").fill("Fictional date round-trip notes.");
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  await expect(page.getByRole("button", { name: title, exact: true })).toHaveCount(1);
}

test("exact-day, month and year editor round trips preserve precision and approximation", async ({ page, context }) => {
  const events = [
    memory(1, { title: "Fictional leap-day memory", date: { kind: "point", value: { year: 2000, month: 2, day: 29 }, approximate: false } }),
    memory(2, { title: "Fictional month memory", date: { kind: "point", value: { year: 2005, month: 9 }, approximate: true } }),
    memory(3, { title: "Fictional year memory", date: { kind: "point", value: { year: 1984 }, approximate: false } }),
  ];
  const state = await workspace(context, events);
  await page.goto(`/projects/${project}`);
  for (const [index, event] of events.entries()) {
    await page.getByRole("button", { name: event.title, exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Date type", exact: true })).toHaveValue("point");
    await expect(page.getByRole("combobox", { name: "Event precision", exact: true })).toHaveValue(["day", "month", "year"][index]);
    await expect(page.getByLabel("Event year", { exact: true })).toHaveValue(["2000", "2005", "1984"][index]);
    if (index < 2) await expect(page.getByLabel("Event month", { exact: true })).toHaveValue(index ? "9" : "2");
    else await expect(page.getByLabel("Event month", { exact: true })).toHaveCount(0);
    if (!index) await expect(page.getByLabel("Event day", { exact: true })).toHaveValue("29");
    else await expect(page.getByLabel("Event day", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("This is approximate", { exact: true })).toBeChecked({ checked: index === 1 });
    await saveRoundTrip(page, event.title);
    expect(state.attempts.at(-1)).toMatchObject({ id: event.id, version: 1, date: event.date });
    expect(state.attempts.at(-1)?.date).toEqual(event.date);
  }
});

test("bounded ranges, ongoing dates and cross-year seasons reopen without inventing precision or an end", async ({ page, context }) => {
  const events: LifeEvent[] = [
    memory(1, { title: "Fictional bounded journey", date: { kind: "range", start: { year: 2001 }, end: { year: 2003, month: 4 }, approximate: true } }),
    memory(2, { title: "Fictional ongoing journey", date: { kind: "range", start: { year: 2012, month: 7 }, end: null, approximate: false } }),
    memory(3, { title: "Fictional winter journey", date: { kind: "season", year: 2005, season: "winter", approximate: true } }),
  ];
  const state = await workspace(context, events);
  await page.goto(`/projects/${project}`);
  for (const [index, event] of events.entries()) {
    await page.getByRole("button", { name: event.title, exact: true }).click();
    if (index < 2) {
      await expect(page.getByRole("combobox", { name: "Date type", exact: true })).toHaveValue("range");
      await expect(page.getByRole("combobox", { name: "Start precision", exact: true })).toHaveValue(index ? "month" : "year");
      await expect(page.getByLabel("Start year", { exact: true })).toHaveValue(index ? "2012" : "2001");
      await expect(page.getByLabel("Still ongoing", { exact: true })).toBeChecked({ checked: index === 1 });
      if (index) {
        await expect(page.getByLabel("Start month", { exact: true })).toHaveValue("7");
        await expect(page.getByLabel("End year", { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByRole("combobox", { name: "End precision", exact: true })).toHaveValue("month");
        await expect(page.getByLabel("End year", { exact: true })).toHaveValue("2003");
        await expect(page.getByLabel("End month", { exact: true })).toHaveValue("4");
      }
    } else {
      await expect(page.getByRole("combobox", { name: "Date type", exact: true })).toHaveValue("season");
      await expect(page.getByRole("combobox", { name: "Season", exact: true })).toHaveValue("winter");
      await expect(page.getByLabel("Season starting year", { exact: true })).toHaveValue("2005");
    }
    await saveRoundTrip(page, event.title);
    expect(state.attempts.at(-1)?.date).toEqual(event.date);
  }
  await expect(page.getByText("Winter 2005", { exact: false })).toBeVisible();
});

test("custom placement round trips keep wording, while switching to unplaced and unknown drops hidden dates", async ({ page, context }) => {
  const event = memory(1, {
    title: "Fictional custom wording",
    date: { kind: "custom", text: "Before the imaginary move", start: { year: 1999, month: 8 }, end: { year: 2000 } },
  });
  const state = await workspace(context, [event]);
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: event.title, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Date type", exact: true })).toHaveValue("custom");
  await expect(page.getByLabel("Date wording", { exact: true })).toHaveValue("Before the imaginary move");
  await expect(page.getByLabel("Add approximate timeline placement", { exact: true })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Start precision", exact: true })).toHaveValue("month");
  await expect(page.getByLabel("Start year", { exact: true })).toHaveValue("1999");
  await expect(page.getByLabel("Start month", { exact: true })).toHaveValue("8");
  await expect(page.getByLabel("End year", { exact: true })).toHaveValue("2000");
  await saveRoundTrip(page, event.title);
  expect(state.attempts.at(-1)?.date).toEqual(event.date);
  await page.getByRole("button", { name: event.title, exact: true }).click();
  await page.getByLabel("Add approximate timeline placement", { exact: true }).uncheck();
  await saveRoundTrip(page, event.title);
  expect(state.attempts.at(-1)?.date).toEqual({
    kind: "custom", text: "Before the imaginary move", start: null, end: null,
  });
  await page.getByRole("button", { name: event.title, exact: true }).click();
  await expect(page.getByLabel("Add approximate timeline placement", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Start year", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Date type", exact: true }).selectOption("unknown");
  await saveRoundTrip(page, event.title);
  expect(state.attempts.at(-1)?.date).toEqual({ kind: "unknown" });
  await expect(page.getByRole("heading", { name: "Undated", exact: true })).toBeVisible();
  await page.getByRole("button", { name: event.title, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Date type", exact: true })).toHaveValue("unknown");
  await expect(page.getByLabel("Date wording", { exact: true })).toHaveCount(0);
});

test("more than fifty equal-date memories paginate once each and an edit resets the page without losing filters", async ({ page, context }) => {
  const events = Array.from({ length: 57 }, (_, index) => memory(index + 1, {
    title: `Fictional [camp]? memory ${String(index + 1).padStart(2, "0")}`,
    date: { kind: "point", value: { year: 2005, month: 9, day: 1 }, approximate: false },
    start_date: "2005-09-01", end_date: "2005-09-01", category_ids: [category],
  }));
  const state = await workspace(context, events);
  await page.goto(`/projects/${project}`);
  const timeline = page.getByRole("region", { name: "Project timeline", exact: true });
  await expect(timeline.getByRole("article")).toHaveCount(50);
  await page.getByLabel("Search memories", { exact: true }).fill("[camp]?");
  await page.getByRole("listbox", { name: "People", exact: true }).selectOption(person);
  await page.getByRole("listbox", { name: "Categories", exact: true }).selectOption(category);
  await page.getByLabel("From", { exact: true }).fill("2005-01-01");
  await page.getByLabel("To", { exact: true }).fill("2005-12-31");
  await page.getByLabel("Include Undated", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("q")).toBe("[camp]?");
  await page.getByRole("button", { name: "Load more memories", exact: true }).click();
  await expect(timeline.getByRole("article")).toHaveCount(57);
  await expect(page.getByRole("button", { name: "Load more memories", exact: true })).toHaveCount(0);
  expect(await timeline.getByRole("article").evaluateAll((articles) =>
    articles.map((article) => article.querySelector("button")?.textContent))).toEqual(events.map((event) => event.title));
  expect(state.reads.at(-1)?.searchParams.get("offset")).toBe("50");
  await page.getByRole("button", { name: events[52].title, exact: true }).click();
  await page.getByLabel("What happened?").fill("Fictional [camp]? revised memory 53");
  await page.getByRole("button", { name: "Save event to account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your event is saved to your account." })).toBeVisible();
  await expect(timeline.getByRole("article")).toHaveCount(50);
  await expect(page.getByLabel("Search memories", { exact: true })).toHaveValue("[camp]?");
  await expect(page.getByRole("listbox", { name: "People", exact: true })).toHaveValues([person]);
  await expect(page.getByRole("listbox", { name: "Categories", exact: true })).toHaveValues([category]);
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2005-01-01");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("2005-12-31");
  await expect(page.getByLabel("Include Undated", { exact: true })).not.toBeChecked();
  const refreshed = state.reads.at(-1)!.searchParams;
  expect(Object.fromEntries(refreshed)).toEqual({
    offset: "0", q: "[camp]?", from: "2005-01-01", to: "2005-12-31",
    undated: "false", person, category,
  });
  await page.getByRole("button", { name: "Load more memories", exact: true }).click();
  await expect(timeline.getByRole("article")).toHaveCount(57);
  await expect(page.getByRole("button", { name: "Fictional [camp]? revised memory 53", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: events[52].title, exact: true })).toHaveCount(0);
  expect(state.attempts[0]).toMatchObject({ id: events[52].id, version: 1 });
});
