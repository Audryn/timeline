import Dexie, { type EntityTable } from "dexie";
import { z } from "zod";
import { eventFormSchema } from "@/features/events/form";
import { eventInputSchema } from "@/domain/models";

export const draftSchema = z.object({
  key: z.string(), owner: z.uuid(), project: z.uuid(), revision: z.number().int(),
  form: eventFormSchema, pending: eventInputSchema.nullable(),
});
export type Draft = z.infer<typeof draftSchema>;
export class DraftConflict extends Error {}
export class DraftDatabase extends Dexie {
  drafts!: EntityTable<Draft, "key">;
  constructor(name = "timeline-drafts") {
    super(name);
    this.version(1).stores({ drafts: "key,owner,project" });
  }
}
let instance: DraftDatabase | undefined;
export function drafts() { return instance ??= new DraftDatabase(); }
export async function saveDraft(db: DraftDatabase, value: Draft, expectedRevision: number) {
  return db.transaction("rw", db.drafts, async () => {
    const current = await db.drafts.get(value.key);
    if ((current?.revision ?? 0) !== expectedRevision) {
      throw new DraftConflict("This draft changed in another tab. Download your text before reopening the editor.");
    }
    const next = draftSchema.parse({ ...value, revision: expectedRevision + 1 });
    await db.drafts.put(next);
    return next;
  });
}
export async function removeDraft(db: DraftDatabase, key: string, revision: number) {
  return db.transaction("rw", db.drafts, async () => {
    const current = await db.drafts.get(key);
    if (current && current.revision !== revision) throw new DraftConflict("Another tab changed this draft. It has not been deleted.");
    await db.drafts.delete(key);
  });
}
