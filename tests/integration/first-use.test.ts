import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dateBounds, eventDateSchema, type Hemisphere } from "../../src/domain/dates";

const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER_OWNER = "10000000-0000-4000-8000-000000000002";

type Person = { id: string; project_id: string; name: string; kind: string };
type Category = { id: string; project_id: string; name: string; position: number };
type Project = { id: string; people: Person[]; categories: Category[] };
type EventInput = {
  requestId: string;
  id: string;
  version: number;
  title: string;
  description: string;
  location: string;
  date: unknown;
  personIds: string[];
  categoryIds: string[];
};
type EventRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  location: string;
  date: unknown;
  start_date: string | null;
  end_date: string | null;
  version: number;
  person_ids: string[];
  category_ids: string[];
};

let db: PGlite;

async function rows<T>(sql: string, parameters: unknown[] = []) {
  return (await db.query<T>(sql, parameters)).rows;
}

// SET ROLE is session-scoped: restore it even when PostgreSQL rejects a statement.
async function asUser<T>(user: string | null, operation: () => Promise<T>, role: "authenticated" | "anon" = "authenticated") {
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec(role === "anon" ? "set role anon" : "set role authenticated");
    return await operation();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [""]);
  }
}

function projectInput(overrides = {}) {
  return {
    requestId: randomUUID(),
    name: "  My timeline  ",
    hemisphere: "northern",
    personName: "  First person  ",
    personKind: "real",
    ...overrides,
  };
}

async function createProject(input = projectInput(), user: string | null = OWNER) {
  return asUser(user, async () => {
    const [row] = await rows<{ result: { id: string } }>(
      "select public.create_project($1::jsonb) as result", [JSON.stringify(input)],
    );
    return row.result;
  });
}

async function addPerson(project: string, input: { requestId: string; name: string; kind: string }, user: string | null = OWNER) {
  return asUser(user, async () => {
    const [row] = await rows<{ result: Person }>(
      "select public.add_person($1::uuid, $2::jsonb) as result", [project, JSON.stringify(input)],
    );
    return row.result;
  });
}

async function saveEvent(project: string, input: EventInput, user: string | null = OWNER) {
  return asUser(user, async () => {
    const [row] = await rows<{ result: { id: string; version: number } }>(
      "select public.save_event($1::uuid, $2::jsonb) as result", [project, JSON.stringify(input)],
    );
    return row.result;
  });
}

async function setupProject(user = OWNER, hemisphere: Hemisphere = "northern"): Promise<Project> {
  const { id } = await createProject(projectInput({ hemisphere }), user);
  return asUser(user, async () => ({
    id,
    people: await rows<Person>("select * from public.people where project_id = $1::uuid order by id", [id]),
    categories: await rows<Category>("select * from public.categories where project_id = $1::uuid order by position", [id]),
  }));
}

function eventInput(project: Project, overrides: Partial<EventInput> = {}): EventInput {
  return {
    requestId: randomUUID(),
    id: randomUUID(),
    version: 0,
    title: "  First memory  ",
    description: "An important day.",
    location: "Home",
    date: { kind: "point", value: { year: 2024, month: 2 }, approximate: true },
    personIds: [project.people[0].id],
    categoryIds: [project.categories[0].id],
    ...overrides,
  };
}

async function readEvent(id: string, user = OWNER) {
  return asUser(user, async () => (await rows<EventRow>(
    `select id, project_id, title, description, location, date,
       start_date::text, end_date::text, version, person_ids, category_ids
     from public.events where id = $1::uuid`, [id],
  ))[0]);
}

async function counts() {
  return (await rows<Record<string, number>>(`select
    (select count(*)::int from public.projects) as projects,
    (select count(*)::int from public.people) as people,
    (select count(*)::int from public.categories) as categories,
    (select count(*)::int from public.event_records) as events,
    (select count(*)::int from public.event_people) as participants,
    (select count(*)::int from public.event_categories) as event_categories,
    (select count(*)::int from public.mutation_receipts) as receipts`))[0];
}

describe("first-use migration on real PGlite PostgreSQL", { concurrent: false }, () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid
        language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(await readFile(
      new URL("../../supabase/migrations/202610200001_first_use.sql", import.meta.url), "utf8",
    ));
    await db.query("insert into auth.users(id) values ($1::uuid), ($2::uuid)", [OWNER, OTHER_OWNER]);
  }, 60_000);

  beforeEach(async () => {
    await db.exec("truncate public.projects, public.mutation_receipts cascade");
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates a project, its first person, and all 13 ordered categories atomically", async () => {
    const input = projectInput();
    const { id } = await createProject(input);
    await asUser(OWNER, async () => {
      expect(await rows("select id, owner_id, name, hemisphere from public.projects"))
        .toEqual([{ id, owner_id: OWNER, name: "My timeline", hemisphere: "northern" }]);
      expect(await rows("select project_id, name, kind from public.people"))
        .toEqual([{ project_id: id, name: "First person", kind: "real" }]);
      const categories = await rows<Category>("select * from public.categories order by position");
      expect(categories.map(({ name }) => name)).toEqual([
        "Where I lived", "Education", "Work", "Friendships", "Romantic relationships",
        "Travel", "Health", "Children & family", "Events attended", "Athletics",
        "Spiritual life", "Name changes", "Personal growth",
      ]);
      expect(categories.map(({ position }) => position)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
      expect(categories.every((category) => category.project_id === id)).toBe(true);
    });
    expect(await counts()).toEqual({
      projects: 1, people: 1, categories: 13, events: 0, participants: 0, event_categories: 0, receipts: 1,
    });
  });

  it("replays project requests by owner and rejects a changed payload for the same request", async () => {
    const input = projectInput();
    const first = await createProject(input);
    expect(await createProject(input)).toEqual(first);
    await expect(createProject({ ...input, name: "Changed" })).rejects.toMatchObject({
      code: "22023", message: "Use a new request for changed content.",
    });
    const other = await createProject(input, OTHER_OWNER);
    expect(other.id).not.toBe(first.id);
    expect(await counts()).toMatchObject({ projects: 2, people: 2, categories: 26, receipts: 2 });
  });

  it("rolls back an inserted project when first-person setup fails and leaves the request retryable", async () => {
    const input = projectInput({ personName: "   " });
    const before = await counts();
    await expect(createProject(input)).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(before);
    await createProject({ ...input, personName: "Recovered person" });
    expect(await counts()).toMatchObject({ projects: 1, people: 1, categories: 13, receipts: 1 });
  });

  it("adds people idempotently without accepting changed content", async () => {
    const project = await setupProject();
    const input = { requestId: randomUUID(), name: "  Second person  ", kind: "fictional" };
    const first = await addPerson(project.id, input);
    expect(first).toMatchObject({ project_id: project.id, name: "Second person", kind: "fictional" });
    expect(await addPerson(project.id, input)).toEqual(first);
    await expect(addPerson(project.id, { ...input, name: "Different person" })).rejects.toMatchObject({ code: "22023" });
    expect(await counts()).toMatchObject({ people: 2, receipts: 2 });
  });

  it("isolates every readable table and the security-invoker events view by owner", async () => {
    const own = await setupProject();
    const foreign = await setupProject(OTHER_OWNER);
    const ownInput = eventInput(own);
    const foreignInput = eventInput(foreign);
    await saveEvent(own.id, ownInput);
    await saveEvent(foreign.id, foreignInput, OTHER_OWNER);
    for (const [user, project] of [[OWNER, own], [OTHER_OWNER, foreign]] as const) {
      await asUser(user, async () => {
        expect(await rows("select id from public.projects")).toEqual([{ id: project.id }]);
        // Identifiers here come only from this fixed list, never from a request.
        for (const table of ["people", "categories", "event_records", "event_people", "event_categories", "events"]) {
          const visible = await rows<{ project_id: string }>(`select project_id from public.${table}`);
          expect(visible.length).toBe(table === "categories" ? 13 : 1);
          expect(visible.every((row) => row.project_id === project.id)).toBe(true);
        }
      });
    }
    expect(await readEvent(foreignInput.id)).toBeUndefined();
    await expect(asUser(OWNER, () => rows("select * from public.mutation_receipts")))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("rejects foreign-owner RPCs and a foreign event id without changing either project", async () => {
    const own = await setupProject();
    const foreign = await setupProject(OTHER_OWNER);
    const input = eventInput(foreign);
    await saveEvent(foreign.id, input, OTHER_OWNER);
    const before = await counts();
    const foreignEvent = await readEvent(input.id, OTHER_OWNER);
    await expect(addPerson(foreign.id, {
      requestId: randomUUID(), name: "Intruder", kind: "real",
    })).rejects.toMatchObject({ code: "42501", message: "Project is unavailable." });
    await expect(saveEvent(foreign.id, eventInput(foreign))).rejects.toMatchObject({
      code: "42501", message: "Project is unavailable.",
    });
    await expect(saveEvent(own.id, eventInput(own, { id: input.id, version: 1 })))
      .rejects.toMatchObject({ code: "42501", message: "Event is unavailable." });
    expect(await counts()).toEqual(before);
    expect(await readEvent(input.id, OTHER_OWNER)).toEqual(foreignEvent);
  });

  it("denies anonymous execution and authenticated RPCs with no user claim, restoring the role after errors", async () => {
    const project = await setupProject();
    const before = await counts();
    await expect(asUser(null, () => rows(
      "select public.create_project($1::jsonb)", [JSON.stringify(projectInput())],
    ), "anon")).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(null, () => rows("select * from public.projects"), "anon"))
      .rejects.toMatchObject({ code: "42501" });
    await expect(createProject(projectInput(), null)).rejects.toMatchObject({
      code: "42501", message: "Sign in to continue.",
    });
    await expect(addPerson(project.id, {
      requestId: randomUUID(), name: "Nobody", kind: "real",
    }, null)).rejects.toMatchObject({ code: "42501" });
    await expect(saveEvent(project.id, eventInput(project), null)).rejects.toMatchObject({ code: "42501" });
    expect(await asUser(null, () => rows("select id from public.projects"))).toEqual([]);
    expect(await rows("select current_user as role, auth.uid() as uid"))
      .toEqual([{ role: "postgres", uid: null }]);
    expect(await counts()).toEqual(before);
  });

  it("denies direct inserts, updates, and deletes on all mutation tables and the events view", async () => {
    const project = await setupProject();
    const input = eventInput(project);
    await saveEvent(project.id, input);
    const before = await counts();
    const snapshot = await readEvent(input.id);
    for (const [table, key] of [
      ["projects", "id"], ["people", "id"], ["categories", "id"], ["event_records", "id"],
      ["event_people", "event_id"], ["event_categories", "event_id"],
      ["mutation_receipts", "owner_id"], ["events", "id"],
    ]) {
      for (const sql of [
        `insert into public.${table} (${key}) select ${key} from public.${table} where false`,
        `update public.${table} set ${key} = ${key} where false`,
        `delete from public.${table} where false`,
      ]) {
        await expect(asUser(OWNER, () => rows(sql))).rejects.toMatchObject({ code: "42501" });
      }
    }
    expect(await counts()).toEqual(before);
    expect(await readEvent(input.id)).toEqual(snapshot);
  });

  it("saves an event, its participant/category links, and normalized leap-month bounds", async () => {
    const project = await setupProject();
    const person = await addPerson(project.id, { requestId: randomUUID(), name: "Friend", kind: "real" });
    const input = eventInput(project, {
      personIds: [person.id, project.people[0].id],
      categoryIds: [project.categories[2].id, project.categories[0].id],
    });
    expect(await saveEvent(project.id, input)).toEqual({ id: input.id, version: 1 });
    expect(await readEvent(input.id)).toEqual({
      id: input.id, project_id: project.id, title: "First memory", description: input.description,
      location: input.location, date: input.date, start_date: "2024-02-01", end_date: "2024-02-29",
      version: 1, person_ids: [...input.personIds].sort(), category_ids: [...input.categoryIds].sort(),
    });
    await asUser(OWNER, async () => {
      expect(await rows("select event_id, person_id, project_id from public.event_people order by person_id"))
        .toEqual([...input.personIds].sort().map((person_id) => ({ event_id: input.id, person_id, project_id: project.id })));
      expect(await rows("select event_id, category_id, project_id from public.event_categories order by category_id"))
        .toEqual([...input.categoryIds].sort().map((category_id) => ({ event_id: input.id, category_id, project_id: project.id })));
    });
  });

  it.each(["person", "category"] as const)(
    "rejects a cross-project %s on create and edit without partial writes or receipts",
    async (link) => {
      const project = await setupProject();
      const otherProject = await setupProject();
      const input = eventInput(project);
      const foreignLinks = link === "person"
        ? { personIds: [otherProject.people[0].id] }
        : { categoryIds: [otherProject.categories[0].id] };
      const invalid = { ...input, ...foreignLinks };
      const beforeCreate = await counts();
      await expect(saveEvent(project.id, invalid)).rejects.toMatchObject({
        code: "22023", message: "Choose people and categories from this project.",
      });
      expect(await counts()).toEqual(beforeCreate);
      expect(await readEvent(input.id)).toBeUndefined();
      await saveEvent(project.id, input);
      const original = await readEvent(input.id);
      const beforeEdit = await counts();
      const edit = { ...input, ...foreignLinks, requestId: randomUUID(), version: 1, title: "Must not persist" };
      await expect(saveEvent(project.id, edit)).rejects.toMatchObject({ code: "22023" });
      expect(await readEvent(input.id)).toEqual(original);
      expect(await counts()).toEqual(beforeEdit);
      expect(await saveEvent(project.id, { ...edit, personIds: input.personIds, categoryIds: input.categoryIds }))
        .toEqual({ id: input.id, version: 2 });
    },
  );

  it("replays saves without incrementing versions and rejects changed content under the same request id", async () => {
    const project = await setupProject();
    const input = eventInput(project);
    const created = await saveEvent(project.id, input);
    const snapshot = await readEvent(input.id);
    const before = await counts();
    expect(await saveEvent(project.id, input)).toEqual(created);
    await expect(saveEvent(project.id, { ...input, title: "Changed" })).rejects.toMatchObject({
      code: "22023", message: "Use a new request for changed content.",
    });
    expect(await readEvent(input.id)).toEqual(snapshot);
    expect(await counts()).toEqual(before);
  });

  it("rejects stale versions without replacing links and applies sequential edits exactly once", async () => {
    const project = await setupProject();
    const secondPerson = await addPerson(project.id, { requestId: randomUUID(), name: "Second", kind: "real" });
    const input = eventInput(project);
    await saveEvent(project.id, input);
    const edit = {
      ...input, requestId: randomUUID(), version: 1, title: "Edited",
      personIds: [secondPerson.id], categoryIds: [project.categories[1].id],
      date: { kind: "range", start: { year: 2025 }, end: null, approximate: false },
    };
    expect(await saveEvent(project.id, edit)).toEqual({ id: input.id, version: 2 });
    const edited = await readEvent(input.id);
    const beforeStale = await counts();
    await expect(saveEvent(project.id, { ...input, requestId: randomUUID(), version: 1 }))
      .rejects.toMatchObject({ code: "P0001", message: "This event changed elsewhere. Your draft has been kept." });
    expect(await readEvent(input.id)).toEqual(edited);
    expect(await counts()).toEqual(beforeStale);
    expect(await saveEvent(project.id, edit)).toEqual({ id: input.id, version: 2 });
    expect(await readEvent(input.id)).toEqual(edited);
    const next = { ...edit, requestId: randomUUID(), version: 2, title: "Edited again", categoryIds: [] };
    expect(await saveEvent(project.id, next)).toEqual({ id: input.id, version: 3 });
    expect(await readEvent(input.id)).toMatchObject({
      title: "Edited again", version: 3, person_ids: [secondPerson.id], category_ids: [],
      start_date: "2025-01-01", end_date: null,
    });
    expect(await saveEvent(project.id, input)).toEqual({ id: input.id, version: 1 });
    expect(await readEvent(input.id)).toMatchObject({ title: "Edited again", version: 3, category_ids: [] });
  });

  const validDates: { name: string; hemisphere: Hemisphere; date: unknown }[] = [
    { name: "early Gregorian year precision", hemisphere: "northern", date: { kind: "point", value: { year: 42 } } },
    { name: "upper Gregorian year", hemisphere: "northern", date: { kind: "point", value: { year: 9999 } } },
    { name: "leap month precision", hemisphere: "northern", date: { kind: "point", value: { year: 2024, month: 2 } } },
    { name: "non-leap century month", hemisphere: "southern", date: { kind: "point", value: { year: 1900, month: 2 } } },
    { name: "leap century day precision", hemisphere: "northern", date: { kind: "point", value: { year: 2000, month: 2, day: 29 }, approximate: true } },
    { name: "overlapping uncertain endpoints", hemisphere: "northern", date: { kind: "range", start: { year: 2020, month: 8 }, end: { year: 2020 } } },
    { name: "ongoing range", hemisphere: "northern", date: { kind: "range", start: { year: 2021 }, end: null } },
    { name: "unplaced custom wording", hemisphere: "northern", date: { kind: "custom", text: "Before the move", start: null, end: null } },
    { name: "custom start-only month", hemisphere: "southern", date: { kind: "custom", text: "Around the move", start: { year: 2024, month: 2 }, end: null } },
    { name: "custom bounded placement", hemisphere: "northern", date: { kind: "custom", text: "School years", start: { year: 1999 }, end: { year: 2001, month: 6 } } },
    { name: "unknown placement", hemisphere: "southern", date: { kind: "unknown" } },
    ...(["northern", "southern"] as const).flatMap((hemisphere) =>
      (["spring", "summer", "autumn", "winter"] as const).map((season) => ({
        name: `${hemisphere} ${season}, including cross-year leap seasons`,
        hemisphere,
        date: { kind: "season", season, year: 2023 },
      }))),
  ];

  it.each(validDates)("matches TypeScript date bounds for $name", async ({ date, hemisphere }) => {
    const parsed = eventDateSchema.parse(date);
    const project = await setupProject(OWNER, hemisphere);
    const input = eventInput(project, { date: parsed });
    await saveEvent(project.id, input);
    const expected = dateBounds(parsed, hemisphere);
    expect(await readEvent(input.id)).toMatchObject({
      date: parsed, start_date: expected.start, end_date: expected.end,
    });
  });

  const invalidDates = [
    { name: "non-leap century day", date: { kind: "point", value: { year: 1900, month: 2, day: 29 } } },
    { name: "impossible month day", date: { kind: "point", value: { year: 2024, month: 4, day: 31 } } },
    { name: "day without month", date: { kind: "point", value: { year: 2024, day: 2 } } },
    { name: "zero day", date: { kind: "point", value: { year: 2024, month: 2, day: 0 } } },
    { name: "month out of bounds", date: { kind: "point", value: { year: 2024, month: 13 } } },
    { name: "year zero", date: { kind: "point", value: { year: 0 } } },
    { name: "year above supported range", date: { kind: "point", value: { year: 10000 } } },
    { name: "null endpoint", date: { kind: "point", value: null } },
    { name: "string year endpoint", date: { kind: "point", value: { year: "2024" } } },
    { name: "explicit null month endpoint", date: { kind: "point", value: { year: 2024, month: null } } },
    { name: "explicit null day endpoint", date: { kind: "point", value: { year: 2024, month: 2, day: null } } },
    { name: "unknown civil endpoint field", date: { kind: "point", value: { year: 2024, era: "CE" } } },
    { name: "string approximation flag", date: { kind: "point", value: { year: 2024 }, approximate: "false" } },
    { name: "extra point field", date: { kind: "point", value: { year: 2024 }, end: null } },
    { name: "reversed range", date: { kind: "range", start: { year: 2025 }, end: { year: 2020 } } },
    { name: "invalid range end", date: { kind: "range", start: { year: 2023 }, end: { year: 2024, month: 2, day: 30 } } },
    { name: "range without start", date: { kind: "range", start: null, end: { year: 2024 } } },
    { name: "missing range end field", date: { kind: "range", start: { year: 2024 } } },
    { name: "null range approximation flag", date: { kind: "range", start: { year: 2024 }, end: null, approximate: null } },
    { name: "custom end without start", date: { kind: "custom", text: "Before", start: null, end: { year: 2024 } } },
    { name: "missing custom start field", date: { kind: "custom", text: "Before", end: null } },
    { name: "missing custom end field", date: { kind: "custom", text: "Before", start: null } },
    { name: "missing both custom endpoints", date: { kind: "custom", text: "Before" } },
    { name: "nonstring custom wording", date: { kind: "custom", text: 123, start: null, end: null } },
    { name: "extra custom approximation field", date: { kind: "custom", text: "Before", start: null, end: null, approximate: false } },
    { name: "blank custom label", date: { kind: "custom", text: "  ", start: null, end: null } },
    { name: "unsupported season year", date: { kind: "season", season: "winter", year: 9999 } },
    { name: "string season year", date: { kind: "season", season: "winter", year: "2024" } },
    { name: "null season year", date: { kind: "season", season: "winter", year: null } },
    { name: "numeric season approximation flag", date: { kind: "season", season: "winter", year: 2024, approximate: 1 } },
    { name: "unrecognized season", date: { kind: "season", season: "monsoon", year: 2024 } },
    { name: "extra unknown-date field", date: { kind: "unknown", value: { year: 2024 } } },
    { name: "unknown-date approximation field", date: { kind: "unknown", approximate: false } },
  ];

  it.each(invalidDates)("rejects $name like the TypeScript schema, without partial writes", async ({ date }) => {
    expect(eventDateSchema.safeParse(date).success).toBe(false);
    const project = await setupProject();
    const input = eventInput(project, { date });
    const before = await counts();
    await expect(saveEvent(project.id, input)).rejects.toBeDefined();
    expect(await readEvent(input.id)).toBeUndefined();
    expect(await counts()).toEqual(before);
  });
});
