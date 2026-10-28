import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { EventDate } from "@/domain/dates";
import type { LifeEvent } from "@/domain/models";
import { draftDate, emptyDate, eventFormSchema, formForEvent, parseDate, submission } from "./form";

const EVENT_ID = "10000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const PERSON_ID = "30000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "40000000-0000-4000-8000-000000000001";
const REQUEST_ID = "50000000-0000-4000-8000-000000000001";

const dates: { label: string; date: EventDate }[] = [
  { label: "early year", date: { kind: "point", value: { year: 42 }, approximate: false } },
  { label: "approximate month", date: { kind: "point", value: { year: 2024, month: 2 }, approximate: true } },
  { label: "leap day", date: { kind: "point", value: { year: 2000, month: 2, day: 29 }, approximate: false } },
  { label: "mixed-precision range", date: { kind: "range", start: { year: 2020, month: 8 }, end: { year: 2020 }, approximate: true } },
  { label: "ongoing range", date: { kind: "range", start: { year: 2021 }, end: null, approximate: false } },
  { label: "cross-year season", date: { kind: "season", season: "summer", year: 2023, approximate: true } },
  { label: "unplaced wording", date: { kind: "custom", text: "Before the fictional move", start: null, end: null } },
  { label: "placed wording without end", date: { kind: "custom", text: "Around the voyage", start: { year: 1999, month: 12 }, end: null } },
  { label: "placed wording with end", date: { kind: "custom", text: "The academy years", start: { year: 2001 }, end: { year: 2005, month: 6 } } },
  { label: "unknown", date: { kind: "unknown" } },
];

function event(date: EventDate): LifeEvent {
  return {
    id: EVENT_ID, project_id: PROJECT_ID, version: 7,
    title: "A fictional milestone", description: "Invented notes", location: "Imaginary harbour",
    date, start_date: null, end_date: null, person_ids: [PERSON_ID], category_ids: [CATEGORY_ID],
  };
}

describe("event editor conversion", () => {
  it.each(dates)("round-trips $label without inventing precision or resetting the edit version", ({ date }) => {
    expect(submission(formForEvent(event(date)), REQUEST_ID)).toEqual({
      requestId: REQUEST_ID, id: EVENT_ID, version: 7,
      title: "A fictional milestone", description: "Invented notes", location: "Imaginary harbour",
      personIds: [PERSON_ID], categoryIds: [CATEGORY_ID], date,
    });
  });

  it("ignores stale hidden month/day values when precision is reduced", () => {
    const exact = draftDate({ kind: "point", value: { year: 2024, month: 2, day: 29 }, approximate: true });

    expect(parseDate({ ...exact, precision: "month" })).toEqual({
      kind: "point", value: { year: 2024, month: 2 }, approximate: true,
    });
    expect(parseDate({ ...exact, precision: "year" })).toEqual({
      kind: "point", value: { year: 2024 }, approximate: true,
    });
  });

  it("ignores hidden ends while ongoing and restores the chosen end when duration is closed", () => {
    const closed = draftDate({
      kind: "range", start: { year: 2018 }, end: { year: 2020, month: 6 }, approximate: false,
    });
    const ongoing = { ...closed, ongoing: true };

    expect(parseDate(ongoing)).toEqual({
      kind: "range", start: { year: 2018 }, end: null, approximate: false,
    });
    expect(parseDate({ ...ongoing, ongoing: false })).toEqual({
      kind: "range", start: { year: 2018 }, end: { year: 2020, month: 6 }, approximate: false,
    });
  });

  it("keeps custom wording but removes hidden placement when it is disabled", () => {
    const placed = draftDate({
      kind: "custom", text: "The academy years", start: { year: 2001 }, end: { year: 2005 },
    });

    expect(parseDate({ ...placed, placed: false })).toEqual({
      kind: "custom", text: "The academy years", start: null, end: null,
    });
    expect(parseDate({ ...placed, endYear: "" })).toEqual({
      kind: "custom", text: "The academy years", start: { year: 2001 }, end: null,
    });
  });

  it("switches kinds without leaking approximate flags or old date placement", () => {
    const old = {
      ...emptyDate, kind: "range" as const, year: "2020", endYear: "2021",
      text: "  Before the fictional move  ", approximate: true, ongoing: true, placed: false,
    };

    expect(parseDate({ ...old, kind: "unknown" })).toEqual({ kind: "unknown" });
    expect(parseDate({ ...old, kind: "custom" })).toEqual({
      kind: "custom", text: "Before the fictional move", start: null, end: null,
    });
    expect(parseDate({ ...old, kind: "season", season: "winter" })).toEqual({
      kind: "season", season: "winter", year: 2020, approximate: true,
    });
  });

  it("retains an incomplete local draft but rejects it as a cloud submission", () => {
    const incomplete = { ...formForEvent(event({ kind: "unknown" })), title: "", date: { ...emptyDate, kind: "point" as const } };

    expect(eventFormSchema.safeParse(incomplete).success).toBe(true);
    expect(() => submission(incomplete, REQUEST_ID)).toThrow(z.ZodError);
    expect(incomplete.date.year).toBe("");
  });

  it.each([
    { label: "invalid leap day", date: { ...emptyDate, kind: "point" as const, precision: "day" as const, year: "1900", month: "2", day: "29" } },
    { label: "inverted range", date: { ...emptyDate, kind: "range" as const, year: "2025", endYear: "2020" } },
    { label: "blank custom wording", date: { ...emptyDate, kind: "custom" as const, text: " " } },
  ])("rejects $label instead of coercing it into a valid event", ({ date }) => {
    expect(() => parseDate(date)).toThrow(z.ZodError);
  });

  it("normalizes submission text but preserves meaningful notes and association identities", () => {
    const form = {
      ...formForEvent(event({ kind: "unknown" })),
      title: "  Fictional departure  ", location: "  Imaginary harbour  ", description: "  Deliberate notes\n",
    };

    expect(submission(form, REQUEST_ID)).toMatchObject({
      title: "Fictional departure", location: "Imaginary harbour", description: "  Deliberate notes\n",
      personIds: [PERSON_ID], categoryIds: [CATEGORY_ID],
    });
    expect(form.title).toBe("  Fictional departure  ");
  });
});
