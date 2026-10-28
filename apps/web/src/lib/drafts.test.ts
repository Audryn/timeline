import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drafts, DraftDatabase, DraftConflict, removeDraft, saveDraft, type Draft } from "./drafts";
import { emptyDate } from "@/features/events/form";

const databases: DraftDatabase[] = [];
function database() { const db = new DraftDatabase(crypto.randomUUID()); databases.push(db); return db; }
function draft(owner = crypto.randomUUID()): Draft {
  const id = crypto.randomUUID();
  return {
    key: `${owner}:${id}`, owner, project: crypto.randomUUID(), revision: 0, pending: null,
    form: { id, version: 0, title: "", description: "", location: "", personIds: [], categoryIds: [], date: emptyDate },
  };
}
afterEach(async () => { for (const db of databases.splice(0)) await db.delete(); });
describe("recoverable browser drafts", () => {
  it("recovers incomplete drafts without requiring event validation", async () => {
    const db = database(); const value = draft();
    const saved = await saveDraft(db, value, 0);
    expect(saved.revision).toBe(1);
    expect((await db.drafts.get(value.key))?.form.title).toBe("");
  });
  it("rejects stale tab writes and stale deletes without losing the current draft", async () => {
    const db = database(); const value = draft();
    await saveDraft(db, value, 0);
    await expect(saveDraft(db, { ...value, form: { ...value.form, title: "Other tab" } }, 0)).rejects.toBeInstanceOf(DraftConflict);
    await expect(removeDraft(db, value.key, 0)).rejects.toBeInstanceOf(DraftConflict);
    expect((await db.drafts.get(value.key))?.revision).toBe(1);
  });
  it("scopes retrieval and cleanup to the owner", async () => {
    const db = database(); const one = draft(); const two = draft();
    await saveDraft(db, one, 0); await saveDraft(db, two, 0);
    await db.drafts.where("owner").equals(one.owner).delete();
    expect(await db.drafts.where("owner").equals(one.owner).count()).toBe(0);
    expect(await db.drafts.where("owner").equals(two.owner).count()).toBe(1);
  });
  it("allows explicit recovery after a cached database-open failure", async () => {
    const open = vi.spyOn(IDBFactory.prototype, "open").mockImplementation(() => {
      throw new DOMException("Synthetic database open failure", "InvalidStateError");
    });
    const failed = drafts();
    try {
      await expect(failed.drafts.get("synthetic-key")).rejects.toBeDefined();
      expect(failed.hasFailed()).toBe(true);
    } finally { open.mockRestore(); }
    const recovered = drafts();
    databases.push(recovered);
    expect(recovered).not.toBe(failed);
    expect(await recovered.drafts.get("synthetic-key")).toBeUndefined();
  });
});
