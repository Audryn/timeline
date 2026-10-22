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
});
