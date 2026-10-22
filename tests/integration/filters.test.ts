import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { timelineLogic } from "../../src/domain/filters";

const PROJECT = "10000000-0000-4000-8000-000000000001";
const bounds = { from: "2020-01-01", to: "2024-12-31", undated: true };

async function captureQuery(filters: Parameters<typeof timelineLogic>[0]) {
  const requests: URL[] = [];
  const client = createClient("https://timeline.example.invalid", "integration-test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input) => {
        requests.push(new URL(input instanceof Request ? input.url : input.toString()));
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  const { error, data } = await client.from("events").select("*")
    .eq("project_id", PROJECT).or(timelineLogic(filters));
  expect(error).toBeNull();
  expect(data).toEqual([]);
  expect(requests).toHaveLength(1);
  expect(requests[0].pathname).toBe("/rest/v1/events");
  expect(requests[0].searchParams.getAll("project_id")).toEqual([`eq.${PROJECT}`]);
  expect(requests[0].searchParams.getAll("or")).toHaveLength(1);
  expect([...requests[0].searchParams.keys()].sort()).toEqual(["or", "project_id", "select"]);
  return requests[0].searchParams.get("or")!;
}

describe("timeline filters serialized by the real Supabase query builder", () => {
  it("retains search, date overlap, and undated groups in one conjunctive or parameter", async () => {
    expect(await captureQuery({ text: "first memory", ...bounds })).toBe(
      '(and(or(title.ilike."%first memory%",description.ilike."%first memory%",location.ilike."%first memory%"),' +
      "or(and(start_date.not.is.null,or(end_date.is.null,end_date.gte.2020-01-01)," +
      "start_date.lte.2024-12-31),start_date.is.null)))",
    );
  });

  it("keeps the date overlap group when search and undated records are excluded", async () => {
    expect(await captureQuery({ text: "", ...bounds, undated: false })).toBe(
      "(and(and(start_date.not.is.null,or(end_date.is.null,end_date.gte.2020-01-01)," +
      "start_date.lte.2024-12-31)))",
    );
  });

  it.each([
    { name: "literal percent and underscore", text: "100%_complete", literal: String.raw`%100\%\_complete%` },
    { name: "double quotes", text: 'He said "go"', literal: String.raw`%He said \"go\"%` },
    { name: "commas", text: "one,two", literal: "%one,two%" },
    { name: "backslashes", text: String.raw`C:\notes`, literal: String.raw`%C:\\notes%` },
    {
      name: "combined filter-syntax injection attempt",
      text: 'x"),project_id.neq.secret,("%_',
      literal: String.raw`%x\"),project\_id.neq.secret,(\"\%\_%`,
    },
  ])("keeps $name inside all three quoted search literals", async ({ text, literal }) => {
    const logic = await captureQuery({ text, ...bounds });
    // Remove only complete quoted values, honoring PostgREST backslash escapes.
    const quotedValue = /"((?:\\.|[^"\\])*)"/g;
    expect([...logic.matchAll(quotedValue)].map((match) => match[1])).toEqual([literal, literal, literal]);
    expect(logic.replace(quotedValue, '"literal"')).toBe(
      '(and(or(title.ilike."literal",description.ilike."literal",location.ilike."literal"),' +
      "or(and(start_date.not.is.null,or(end_date.is.null,end_date.gte.2020-01-01)," +
      "start_date.lte.2024-12-31),start_date.is.null)))",
    );
  });
});
