import { z } from "zod";
import { eventDateSchema } from "./dates";

export const categoryNames = [
  "Where I lived", "Education", "Work", "Friendships", "Romantic relationships",
  "Travel", "Health", "Children & family", "Events attended", "Athletics",
  "Spiritual life", "Name changes", "Personal growth",
] as const;
export const personSchema = z.object({
  id: z.uuid(), project_id: z.uuid(), name: z.string(),
  kind: z.enum(["real", "fictional"]),
});
export const categorySchema = z.object({
  id: z.uuid(), project_id: z.uuid(), name: z.string(), color: z.string(),
});
export const projectSchema = z.object({
  id: z.uuid(), name: z.string(), hemisphere: z.enum(["northern", "southern"]),
});
export const projectInputSchema = z.object({
  requestId: z.uuid(), name: z.string().trim().min(1).max(120),
  personName: z.string().trim().min(1).max(100),
  personKind: z.enum(["real", "fictional"]),
  hemisphere: z.enum(["northern", "southern"]),
}).strict();
export const personInputSchema = z.object({
  requestId: z.uuid(), name: z.string().trim().min(1).max(100),
  kind: z.enum(["real", "fictional"]),
}).strict();
export const eventInputSchema = z.object({
  requestId: z.uuid(), id: z.uuid(), version: z.number().int().min(0),
  title: z.string().trim().min(1, "Give this event a title.").max(200),
  description: z.string().max(20000), location: z.string().trim().max(300),
  date: eventDateSchema,
  personIds: z.array(z.uuid()).min(1, "Choose at least one person.").max(100),
  categoryIds: z.array(z.uuid()).max(50),
}).strict().refine((event) => new Set(event.personIds).size === event.personIds.length &&
  new Set(event.categoryIds).size === event.categoryIds.length, "Remove duplicate selections.");
export const eventSchema = z.object({
  id: z.uuid(), project_id: z.uuid(), version: z.number().int(),
  title: z.string(), description: z.string(), location: z.string(), date: eventDateSchema,
  start_date: z.string().nullable(), end_date: z.string().nullable(),
  person_ids: z.array(z.uuid()), category_ids: z.array(z.uuid()),
});
export const sessionSchema = z.object({
  configured: z.boolean(),
  user: z.object({ id: z.uuid(), email: z.string() }).nullable(),
});
export type Project = z.infer<typeof projectSchema>;
export type Person = z.infer<typeof personSchema>;
export type Category = z.infer<typeof categorySchema>;
export type LifeEvent = z.infer<typeof eventSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type PersonInput = z.infer<typeof personInputSchema>;
export type Session = z.infer<typeof sessionSchema>;
