import type { BrowserContext, Page } from "@playwright/test";
import type { EventInput, LifeEvent } from "../../../src/domain/models";
import type { Draft } from "../../../src/lib/drafts";

export const owner = "10000000-0000-4000-8000-000000000001";
export const otherOwner = "10000000-0000-4000-8000-000000000002";
export const project = "20000000-0000-4000-8000-000000000001";
export const person = "30000000-0000-4000-8000-000000000001";
export const category = "40000000-0000-4000-8000-000000000001";
export const detail = {
  project: { id: project, name: "My life", hemisphere: "northern" },
  people: [{ id: person, project_id: project, name: "Alex", kind: "real" }],
  categories: [{ id: category, project_id: project, name: "Education", color: "#216353" }],
};

export function memory(index: number, overrides: Partial<LifeEvent> = {}): LifeEvent {
  return {
    id: `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    project_id: project, version: 1, title: `Fictional memory ${index}`,
    description: "", location: "", date: { kind: "unknown" },
    start_date: null, end_date: null, person_ids: [person], category_ids: [],
    ...overrides,
  };
}

export async function workspace(context: BrowserContext, events: LifeEvent[] = []) {
  const state = {
    user: { id: owner, email: "alex@example.com" },
    events: structuredClone(events),
    attempts: [] as EventInput[],
    reads: [] as URL[],
  };
  await context.route("**/api/session", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: { configured: true, user: state.user } });
  });
  await context.route(`**/api/projects/${project}`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: detail });
  });
  await context.route(`**/api/projects/${project}/events**`, async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON() as EventInput;
      state.attempts.push(input);
      const old = state.events.findIndex((entry) => entry.id === input.id);
      const event: LifeEvent = {
        ...(state.events[old] ?? memory(1)), id: input.id, version: input.version + 1,
        title: input.title, description: input.description, location: input.location, date: input.date,
        person_ids: input.personIds, category_ids: input.categoryIds,
      };
      if (old < 0) state.events.push(event);
      else state.events[old] = { ...state.events[old], ...event };
      await route.fulfill({ json: { id: input.id, version: event.version } });
      return;
    }
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    state.reads.push(url);
    // Scenario rows are already selected; this fixture tests outbound filter
    // intent and browser pagination, not database filter membership or sorting.
    const offset = Number(url.searchParams.get("offset") ?? 0);
    await route.fulfill({ json: {
      events: state.events.slice(offset, offset + 50),
      hasMore: offset + 50 < state.events.length,
    } });
  });
  return state;
}

export async function openNew(page: Page) {
  await page.getByRole("button", { name: "+ Add event / recover new draft", exact: true }).click();
  await page.getByLabel("What happened?").waitFor({ state: "visible" });
}

export async function storedDrafts(page: Page): Promise<Draft[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("timeline-drafts");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Draft[]>((resolve, reject) => {
        const transaction = db.transaction("drafts", "readonly");
        const request = transaction.objectStore("drafts").getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
}

type DraftFault = "open" | "write" | "delete";
type FaultWindow = Window & { timelineDraftFault?: DraftFault | null };

export async function draftFault(context: BrowserContext, fault: DraftFault) {
  await context.addInitScript((initialFault) => {
    (window as FaultWindow).timelineDraftFault = initialFault;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      if (args[0] === "timeline-drafts" && (window as FaultWindow).timelineDraftFault === "open") {
        throw new DOMException("Synthetic draft database open failure.", "UnknownError");
      }
      return open.apply(this, args);
    };
    const put = IDBObjectStore.prototype.put;
    const remove = IDBObjectStore.prototype.delete;
    function fails(store: IDBObjectStore, expected: DraftFault) {
      return store.transaction.db.name === "timeline-drafts" && store.name === "drafts"
        && (window as FaultWindow).timelineDraftFault === expected;
    }
    IDBObjectStore.prototype.put = function (...args) {
      if (fails(this, "write")) throw new DOMException("Synthetic draft write failure.", "QuotaExceededError");
      return put.apply(this, args);
    };
    IDBObjectStore.prototype.delete = function (...args) {
      if (fails(this, "delete")) throw new DOMException("Synthetic draft delete failure.", "UnknownError");
      return remove.apply(this, args);
    };
  }, fault);
}

export async function clearDraftFault(page: Page) {
  await page.evaluate(() => { (window as FaultWindow).timelineDraftFault = null; });
}
