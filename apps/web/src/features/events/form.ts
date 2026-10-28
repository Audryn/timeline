import { z } from "zod";
import { eventDateSchema, type CivilDate, type EventDate } from "@/domain/dates";
import { eventInputSchema, type LifeEvent } from "@/domain/models";

export const dateDraftSchema = z.object({
  kind: z.enum(["point", "range", "season", "custom", "unknown"]),
  precision: z.enum(["year", "month", "day"]), year: z.string(), month: z.string(), day: z.string(),
  endPrecision: z.enum(["year", "month", "day"]), endYear: z.string(), endMonth: z.string(), endDay: z.string(),
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  text: z.string(), approximate: z.boolean(), ongoing: z.boolean(), placed: z.boolean(),
});
export const eventFormSchema = z.object({
  id: z.uuid(), version: z.number().int().min(0),
  title: z.string(), description: z.string(), location: z.string(),
  personIds: z.array(z.uuid()), categoryIds: z.array(z.uuid()), date: dateDraftSchema,
});
export type DateDraft = z.infer<typeof dateDraftSchema>;
export type EventForm = z.infer<typeof eventFormSchema>;
export const emptyDate: DateDraft = {
  kind: "unknown", precision: "year", year: "", month: "", day: "",
  endPrecision: "year", endYear: "", endMonth: "", endDay: "",
  season: "autumn", text: "", approximate: false, ongoing: false, placed: false,
};
export function parseDate(form: DateDraft): EventDate {
  const civil = (end = false): CivilDate => {
    const precision = end ? form.endPrecision : form.precision;
    return {
      year: Number(end ? form.endYear : form.year),
      ...(precision !== "year" ? { month: Number(end ? form.endMonth : form.month) } : {}),
      ...(precision === "day" ? { day: Number(end ? form.endDay : form.day) } : {}),
    };
  };
  if (form.kind === "point") return eventDateSchema.parse({ kind: "point", value: civil(), approximate: form.approximate });
  if (form.kind === "range") return eventDateSchema.parse({ kind: "range", start: civil(), end: form.ongoing ? null : civil(true), approximate: form.approximate });
  if (form.kind === "season") return eventDateSchema.parse({ kind: "season", season: form.season, year: Number(form.year), approximate: form.approximate });
  if (form.kind === "custom") return eventDateSchema.parse({
    kind: "custom", text: form.text, start: form.placed ? civil() : null,
    end: form.placed && form.endYear ? civil(true) : null,
  });
  return { kind: "unknown" };
}
function civilFields(value: CivilDate, end = false) {
  const precision = value.day ? "day" : value.month ? "month" : "year";
  return end
    ? { endPrecision: precision, endYear: String(value.year), endMonth: value.month ? String(value.month) : "", endDay: value.day ? String(value.day) : "" } as const
    : { precision, year: String(value.year), month: value.month ? String(value.month) : "", day: value.day ? String(value.day) : "" } as const;
}
export function draftDate(date: EventDate): DateDraft {
  const result: DateDraft = { ...emptyDate, kind: date.kind };
  if ("approximate" in date) result.approximate = date.approximate;
  if (date.kind === "point") Object.assign(result, civilFields(date.value));
  if (date.kind === "range") {
    Object.assign(result, civilFields(date.start));
    result.ongoing = !date.end;
    if (date.end) Object.assign(result, civilFields(date.end, true));
  }
  if (date.kind === "season") { result.year = String(date.year); result.season = date.season; }
  if (date.kind === "custom") {
    result.text = date.text; result.placed = Boolean(date.start);
    if (date.start) Object.assign(result, civilFields(date.start));
    if (date.end) Object.assign(result, civilFields(date.end, true));
  }
  return result;
}
export function formForEvent(event: LifeEvent): EventForm {
  return {
    id: event.id, version: event.version, title: event.title, description: event.description,
    location: event.location, personIds: event.person_ids, categoryIds: event.category_ids, date: draftDate(event.date),
  };
}
export function submission(form: EventForm, requestId: string) {
  return eventInputSchema.parse({ ...form, date: parseDate(form.date), requestId });
}
