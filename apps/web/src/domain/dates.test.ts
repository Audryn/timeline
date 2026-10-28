import { describe, expect, it } from "vitest";
import { civilSchema, dateBounds, dateLabel, eventDateSchema } from "./dates";

describe("civil life-event dates", () => {
  it("validates real leap days and requires a month for a day", () => {
    expect(civilSchema.safeParse({ year: 2000, month: 2, day: 29 }).success).toBe(true);
    expect(civilSchema.safeParse({ year: 1900, month: 2, day: 29 }).success).toBe(false);
    expect(civilSchema.safeParse({ year: 2020, day: 1 }).success).toBe(false);
  });
  it("keeps year and month precision, including early Gregorian years", () => {
    expect(dateBounds({ kind: "point", value: { year: 42 }, approximate: true }, "northern"))
      .toEqual({ start: "0042-01-01", end: "0042-12-31" });
    expect(dateBounds({ kind: "point", value: { year: 2024, month: 2 }, approximate: false }, "southern"))
      .toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("places cross-year seasons using the year they start", () => {
    expect(dateBounds({ kind: "season", season: "winter", year: 2023, approximate: false }, "northern"))
      .toEqual({ start: "2023-12-01", end: "2024-02-29" });
    expect(dateBounds({ kind: "season", season: "summer", year: 2023, approximate: false }, "southern"))
      .toEqual({ start: "2023-12-01", end: "2024-02-29" });
  });
  it("rejects inverted ranges but permits overlapping uncertain endpoints", () => {
    expect(eventDateSchema.safeParse({ kind: "range", start: { year: 2025 }, end: { year: 2020 } }).success).toBe(false);
    expect(eventDateSchema.safeParse({ kind: "range", start: { year: 2020, month: 8 }, end: { year: 2020 } }).success).toBe(true);
  });
  it("does not invent a placement for custom wording or an end for ongoing events", () => {
    expect(dateBounds({ kind: "custom", text: "Before we moved", start: null, end: null }, "northern"))
      .toEqual({ start: null, end: null });
    expect(dateBounds({ kind: "range", start: { year: 2021 }, end: null, approximate: true }, "northern"))
      .toEqual({ start: "2021-01-01", end: null });
    expect(dateLabel({ kind: "point", value: { year: 2005, month: 9 }, approximate: true })).toBe("About September 2005");
  });
  it.each([
    { year: 0 }, { year: 10000 }, { year: 2024.5 }, { year: "2024" },
    { year: 2024, month: 0 }, { year: 2024, month: 13 },
    { year: 2024, month: 4, day: 31 }, { year: 2024, timestamp: "2024-01-01" },
  ])("rejects invalid or non-civil date shape %j", (value) => {
    expect(civilSchema.safeParse(value).success).toBe(false);
  });
  it("keeps year 9999 civil bounds valid but reserves a year for cross-year seasons", () => {
    expect(dateBounds({ kind: "point", value: { year: 9999 }, approximate: false }, "northern"))
      .toEqual({ start: "9999-01-01", end: "9999-12-31" });
    expect(eventDateSchema.safeParse({ kind: "season", season: "winter", year: 9999 }).success).toBe(false);
  });
  it("does not make custom placement into an ongoing interval or change the wording", () => {
    const date = { kind: "custom" as const, text: "The winter before the voyage", start: { year: 2024, month: 2 }, end: null };
    expect(dateBounds(date, "southern")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(dateLabel(date)).toBe("The winter before the voyage");
    expect(eventDateSchema.safeParse({ ...date, start: null, end: { year: 2024 } }).success).toBe(false);
  });
  it("rejects mixed date kinds and approximate flags on unknown dates", () => {
    expect(eventDateSchema.safeParse({ kind: "point", value: { year: 2024 }, end: null }).success).toBe(false);
    expect(eventDateSchema.safeParse({ kind: "unknown", approximate: true }).success).toBe(false);
  });
  it("labels civil dates and open ends without timestamp or locale conversion", () => {
    expect(dateLabel({ kind: "point", value: { year: 42, month: 1, day: 1 }, approximate: false })).toBe("January 1, 42");
    expect(dateLabel({ kind: "range", start: { year: 2021, month: 3 }, end: null, approximate: true })).toBe("About March 2021 - present");
  });
});
