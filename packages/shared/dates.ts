import { z } from "zod";

export type Hemisphere = "northern" | "southern";
const pad = (value: number, width = 2) => String(value).padStart(width, "0");
const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
export function daysInMonth(year: number, month: number) {
  return [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export const civilSchema = z.object({
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.day && (!value.month || value.day > daysInMonth(value.year, value.month))) {
    ctx.addIssue({ code: "custom", path: ["day"], message: "Choose a valid day and month." });
  }
});
export type CivilDate = z.infer<typeof civilSchema>;
export function civilBounds(value: CivilDate): [string, string] {
  const startMonth = value.month ?? 1;
  const endMonth = value.month ?? 12;
  return [
    `${pad(value.year, 4)}-${pad(startMonth)}-${pad(value.day ?? 1)}`,
    `${pad(value.year, 4)}-${pad(endMonth)}-${pad(value.day ?? daysInMonth(value.year, endMonth))}`,
  ];
}

const approximate = z.boolean().default(false);
export const eventDateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("point"), value: civilSchema, approximate }).strict(),
  z.object({ kind: z.literal("range"), start: civilSchema, end: civilSchema.nullable(), approximate }).strict(),
  z.object({
    kind: z.literal("season"),
    season: z.enum(["spring", "summer", "autumn", "winter"]),
    year: z.number().int().min(1).max(9998),
    approximate,
  }).strict(),
  z.object({
    kind: z.literal("custom"),
    text: z.string().trim().min(1).max(200),
    start: civilSchema.nullable(),
    end: civilSchema.nullable(),
  }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
]).superRefine((date, ctx) => {
  if (date.kind === "custom" && !date.start && date.end) {
    ctx.addIssue({ code: "custom", message: "Placement needs a start date." });
  }
  if ((date.kind === "range" || date.kind === "custom") && date.start && date.end &&
      civilBounds(date.start)[0] > civilBounds(date.end)[1]) {
    ctx.addIssue({ code: "custom", message: "The end must not precede the start." });
  }
});
export type EventDate = z.infer<typeof eventDateSchema>;
export type Bounds = { start: string | null; end: string | null };
export function dateBounds(date: EventDate, hemisphere: Hemisphere): Bounds {
  if (date.kind === "unknown") return { start: null, end: null };
  if (date.kind === "point") {
    const [start, end] = civilBounds(date.value);
    return { start, end };
  }
  if (date.kind === "season") {
    const northern = { spring: 3, summer: 6, autumn: 9, winter: 12 };
    const southern = { spring: 9, summer: 12, autumn: 3, winter: 6 };
    const month = (hemisphere === "northern" ? northern : southern)[date.season];
    const endMonth = ((month + 1) % 12) + 1;
    const endYear = date.year + (month === 12 ? 1 : 0);
    return {
      start: `${pad(date.year, 4)}-${pad(month)}-01`,
      end: `${pad(endYear, 4)}-${pad(endMonth)}-${daysInMonth(endYear, endMonth)}`,
    };
  }
  if (!date.start) return { start: null, end: null };
  return {
    start: civilBounds(date.start)[0],
    end: date.end ? civilBounds(date.end)[1] : date.kind === "custom" ? civilBounds(date.start)[1] : null,
  };
}
function civilLabel(date: CivilDate) {
  if (!date.month) return String(date.year);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[date.month - 1]}${date.day ? ` ${date.day},` : ""} ${date.year}`;
}
export function dateLabel(date: EventDate) {
  if (date.kind === "unknown") return "Date unknown";
  if (date.kind === "custom") return date.text;
  const prefix = date.approximate ? "About " : "";
  if (date.kind === "point") return prefix + civilLabel(date.value);
  if (date.kind === "season") return prefix + date.season[0].toUpperCase() + date.season.slice(1) + " " + date.year;
  return `${prefix}${civilLabel(date.start)} - ${date.end ? civilLabel(date.end) : "present"}`;
}
