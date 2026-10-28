import type { createServerClient, CookieOptions } from "@supabase/ssr";
import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { eventInputSchema, personInputSchema, projectInputSchema } from "../../src/domain/models";
import { GET as sessionGET } from "../../src/app/api/session/route";
import { GET as projectsGET, POST as projectPOST } from "../../src/app/api/projects/route";
import { GET as projectGET } from "../../src/app/api/projects/[id]/route";
import { POST as personPOST } from "../../src/app/api/projects/[id]/people/route";
import { GET as eventsGET, POST as eventPOST } from "../../src/app/api/projects/[id]/events/route";
import { POST as authPOST } from "../../src/app/api/auth/[action]/route";
import { GET as callbackGET } from "../../src/app/api/auth/callback/route";

type Auth = SupabaseClient["auth"];
type BoundaryUser = Pick<User, "id" | "email" | "email_confirmed_at">;
type ProviderError = Pick<AuthError, "message" | "name" | "status">;
type AuthResult = { data: { user: BoundaryUser | null }; error: ProviderError | null };
type AuthOperation<K extends keyof Auth> =
  Auth[K] extends (...args: infer Args) => unknown ? (...args: Args) => Promise<AuthResult> : never;
type ClientOptions = Parameters<typeof createServerClient>[2];
type ProjectInput = z.output<typeof projectInputSchema>;
type PersonInput = z.output<typeof personInputSchema>;
type EventInput = z.output<typeof eventInputSchema>;
type ProviderResult = { data: unknown; error: { code?: string; message: string } | null };
type RpcArgs =
  | [name: "create_project", args: { p_input: ProjectInput }]
  | [name: "add_person", args: { p_project: string; p_input: PersonInput }]
  | [name: "save_event", args: { p_project: string; p_input: EventInput }];
type Table = "projects" | "people" | "categories" | "events";
type Query = PromiseLike<ProviderResult> & {
  select: (columns: string) => Query;
  eq: (column: string, value: string) => Query;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => Query;
  limit: (count: number) => Query;
  overlaps: (column: string, values: string[]) => Query;
  or: (logic: string) => Query;
  range: (from: number, to: number) => Query;
  maybeSingle: () => Query;
};

const boundary = vi.hoisted(() => {
  const auth = {
    getUser: vi.fn<AuthOperation<"getUser">>(),
    signUp: vi.fn<AuthOperation<"signUp">>(),
    signInWithPassword: vi.fn<AuthOperation<"signInWithPassword">>(),
    resetPasswordForEmail: vi.fn<AuthOperation<"resetPasswordForEmail">>(),
    resend: vi.fn<AuthOperation<"resend">>(),
    exchangeCodeForSession: vi.fn<AuthOperation<"exchangeCodeForSession">>(),
    verifyOtp: vi.fn<AuthOperation<"verifyOtp">>(),
  };
  const rpc = vi.fn<(...args: RpcArgs) => Promise<ProviderResult>>();
  const from = vi.fn<(table: Table) => Query>();
  const jar = {
    getAll: vi.fn<() => { name: string; value: string }[]>(),
    set: vi.fn<(name: string, value: string, options: CookieOptions) => void>(),
  };
  return {
    auth,
    rpc,
    from,
    jar,
    cookies: vi.fn<() => Promise<typeof jar>>(),
    createServerClient: vi.fn<(url: string, key: string, options: ClientOptions) => {
      auth: typeof auth;
      rpc: typeof rpc;
      from: typeof from;
    }>(),
  };
});

vi.mock("next/headers", () => ({ cookies: boundary.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: boundary.createServerClient }));

const ORIGIN = "https://timeline.example.test";
const USER: BoundaryUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "fictional@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const PERSON_ID = "40000000-0000-4000-8000-000000000001";
const OTHER_PERSON_ID = "40000000-0000-4000-8000-000000000002";
const CATEGORY_ID = "50000000-0000-4000-8000-000000000001";
const EVENT_ID = "60000000-0000-4000-8000-000000000001";
const PROJECT: ProjectInput = {
  requestId: "30000000-0000-4000-8000-000000000001",
  name: "  Fictional timeline  ",
  personName: "  Example character  ",
  personKind: "fictional",
  hemisphere: "southern",
};
const CREDENTIALS = { email: USER.email, password: "fictional-test-password" };
const PERSON: PersonInput = {
  requestId: "30000000-0000-4000-8000-000000000002",
  name: "  Another character  ", kind: "fictional",
};
const EVENT: EventInput = {
  requestId: "30000000-0000-4000-8000-000000000003",
  id: EVENT_ID, version: 3, title: "  Fictional departure  ",
  description: "Invented notes", location: "  Imaginary harbour  ",
  personIds: [PERSON_ID, OTHER_PERSON_ID], categoryIds: [CATEGORY_ID],
  date: { kind: "range", start: { year: 2020, month: 6 }, end: null, approximate: true },
};
const context = (id = PROJECT_ID) => ({ params: Promise.resolve({ id }) });

function queryFixture() {
  const result: ProviderResult = { data: [], error: null };
  const promise = Promise.resolve(result);
  const query = {
    select: vi.fn<Query["select"]>(),
    eq: vi.fn<Query["eq"]>(),
    order: vi.fn<Query["order"]>(),
    limit: vi.fn<Query["limit"]>(),
    overlaps: vi.fn<Query["overlaps"]>(),
    or: vi.fn<Query["or"]>(),
    range: vi.fn<Query["range"]>(),
    maybeSingle: vi.fn<Query["maybeSingle"]>(),
    then: promise.then.bind(promise),
  };
  for (const method of [
    query.select, query.eq, query.order, query.limit, query.overlaps, query.or, query.range, query.maybeSingle,
  ]) method.mockReturnValue(query);
  return { query, result };
}
let tables: Record<Table, ReturnType<typeof queryFixture>>;

function providerError(status: number, message: string): ProviderError {
  return { name: "AuthApiError", status, message };
}

function failedAuth(status: number, message: string): AuthResult {
  return { data: { user: null }, error: providerError(status, message) };
}

function writeRequest(path: string, rawBody?: string, origin: string | null = ORIGIN) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin !== null) headers.set("Origin", origin);
  return new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: rawBody });
}

function account(action: string, input: unknown = CREDENTIALS) {
  return authPOST(writeRequest(`/api/auth/${action}`, JSON.stringify(input)), {
    params: Promise.resolve({ action }),
  });
}

async function expectJson(response: Response, status: number, value: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual(value);
}

function clientOptions() {
  const call = boundary.createServerClient.mock.calls.at(-1);
  if (!call) throw new Error("Expected the real server helper to create a client.");
  return call[2];
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", ORIGIN);
  vi.stubEnv("SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fictional-publishable-key");
  vi.stubEnv("NODE_ENV", "test");
  boundary.cookies.mockResolvedValue(boundary.jar);
  boundary.jar.getAll.mockReturnValue([]);
  tables = {
    projects: queryFixture(), people: queryFixture(), categories: queryFixture(), events: queryFixture(),
  };
  boundary.from.mockImplementation((table) => tables[table].query);
  boundary.createServerClient.mockReturnValue({ auth: boundary.auth, rpc: boundary.rpc, from: boundary.from });
  boundary.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  boundary.rpc.mockResolvedValue({ data: { id: PROJECT_ID }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("exported routes with real server helpers (not a Next HTTP-context test)", () => {
  it("reports unconfigured sessions without constructing an external client", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);

    await expectJson(await sessionGET(new Request(`${ORIGIN}/api/session`)), 200, {
      configured: false, user: null,
    });
    expect(boundary.cookies).not.toHaveBeenCalled();
    expect(boundary.createServerClient).not.toHaveBeenCalled();
  });

  it("treats a provider missing-session result as signed out, not setup failure", async () => {
    boundary.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Fictional missing session", status: 400 },
    });

    await expectJson(await sessionGET(new Request(`${ORIGIN}/api/session`)), 200, {
      configured: true, user: null,
    });
    expect(boundary.auth.getUser).toHaveBeenCalledExactlyOnceWith();
  });

  it("accepts a verified same-origin write and passes normalized input to the real RPC mapping", async () => {
    const response = await projectPOST(writeRequest("/api/projects", JSON.stringify(PROJECT)));

    await expectJson(response, 200, { id: PROJECT_ID });
    expect(boundary.auth.getUser).toHaveBeenCalledExactlyOnceWith();
    expect(boundary.rpc).toHaveBeenCalledExactlyOnceWith("create_project", {
      p_input: { ...PROJECT, name: "Fictional timeline", personName: "Example character" },
    });
    expect(boundary.createServerClient).toHaveBeenCalledExactlyOnceWith(
      "https://supabase.example.test", "fictional-publishable-key", expect.objectContaining({
        cookieOptions: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
      }),
    );
  });

  it.each([
    { label: "unverified", user: { ...USER, email_confirmed_at: undefined }, status: 403,
      error: "Confirm your email before continuing." },
    { label: "missing", user: null, status: 401,
      error: "Sign in to continue. Your local draft has not been submitted." },
  ])("rejects a $label private identity before mutation", async ({ user, status, error }) => {
    boundary.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    await expectJson(await projectPOST(writeRequest("/api/projects", JSON.stringify(PROJECT))), status, { error });
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: "foreign", origin: "https://foreign.example.test" },
    { label: "absent", origin: null },
  ])("rejects an $label Origin before parsing or contacting the provider", async ({ origin }) => {
    await expectJson(await projectPOST(writeRequest("/api/projects", "{", origin)), 403, {
      error: "This request must come from the Timeline website.",
    });
    expect(boundary.createServerClient).not.toHaveBeenCalled();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: "malformed JSON", raw: "{", error: "Send a valid form." },
    { label: "missing body", raw: undefined, error: "Send the required form fields." },
  ])("rejects $label through the real bounded JSON helper", async ({ raw, error }) => {
    await expectJson(await projectPOST(writeRequest("/api/projects", raw)), 400, { error });
    expect(boundary.auth.getUser).not.toHaveBeenCalled();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("rejects extra ownership fields instead of stripping them before mutation", async () => {
    const response = await projectPOST(writeRequest("/api/projects", JSON.stringify({
      ...PROJECT, owner_id: USER.id,
    })));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const payload: unknown = await response.json();
    expect(payload).toEqual({ error: expect.stringContaining("owner_id") });
    expect(boundary.auth.getUser).not.toHaveBeenCalled();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("enforces the JSON limit in bytes, not characters or a claimed Content-Length", async () => {
    const raw = JSON.stringify({ ...PROJECT, name: "é".repeat(66_000) });
    expect(raw.length).toBeLessThan(128 * 1024);
    const request = writeRequest("/api/projects", raw);
    request.headers.set("Content-Length", "1");

    await expectJson(await projectPOST(request), 413, { error: "This form is too large." });
    expect(boundary.auth.getUser).not.toHaveBeenCalled();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { status: 400, error: "Unable to sign in. Check your email, password, and email confirmation." },
    { status: 429, error: "Too many attempts. Please wait before trying again." },
  ])("maps signin provider status $status without exposing provider details", async ({ status, error }) => {
    boundary.auth.signInWithPassword.mockResolvedValue(failedAuth(status, "Fictional private provider detail"));

    await expectJson(await account("signin"), status, { error });
    expect(boundary.auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith(CREDENTIALS);
  });

  it("does not claim signup success when the SMTP boundary reports an error", async () => {
    boundary.auth.signUp.mockResolvedValue(failedAuth(500, "Fictional SMTP unavailable"));

    await expectJson(await account("signup"), 400, {
      error: "Account setup failed. Please check your details or try signing in.",
    });
    expect(boundary.auth.signUp).toHaveBeenCalledExactlyOnceWith({
      ...CREDENTIALS, options: { emailRedirectTo: `${ORIGIN}/api/auth/callback` },
    });
  });

  describe("private project and timeline handler contracts (not SQL/provider membership tests)", () => {
    it("limits the project listing and requests only public-to-the-owner summary columns", async () => {
      const projects = [{ id: PROJECT_ID, name: "Fictional timeline", hemisphere: "southern" }];
      tables.projects.result.data = projects;

      await expectJson(await projectsGET(new Request(`${ORIGIN}/api/projects`)), 200, projects);
      expect(boundary.from).toHaveBeenCalledExactlyOnceWith("projects");
      expect(tables.projects.query.select).toHaveBeenCalledExactlyOnceWith("id,name,hemisphere");
      expect(tables.projects.query.order).toHaveBeenCalledExactlyOnceWith("created_at", { ascending: false });
      expect(tables.projects.query.limit).toHaveBeenCalledExactlyOnceWith(100);
    });

    it.each([
      { user: null, status: 401, error: "Sign in to continue. Your local draft has not been submitted." },
      { user: { ...USER, email_confirmed_at: undefined }, status: 403, error: "Confirm your email before continuing." },
    ])("rejects private reads with identity status $status before requesting records", async ({ user, status, error }) => {
      boundary.auth.getUser.mockResolvedValue({ data: { user }, error: null });

      await expectJson(await projectsGET(new Request(`${ORIGIN}/api/projects`)), status, { error });
      expect(boundary.from).not.toHaveBeenCalled();
    });

    it("scopes every project-detail query and returns its associated people/categories", async () => {
      const project = { id: PROJECT_ID, name: "Fictional timeline", hemisphere: "southern" };
      const people = [{ id: PERSON_ID, project_id: PROJECT_ID, name: "Example character", kind: "fictional" }];
      const categories = [{ id: CATEGORY_ID, project_id: PROJECT_ID, name: "Travel", color: "#123456" }];
      tables.projects.result.data = project;
      tables.people.result.data = people;
      tables.categories.result.data = categories;

      await expectJson(await projectGET(new Request(`${ORIGIN}/api/projects/${PROJECT_ID}`), context()), 200, {
        project, people, categories,
      });
      expect(boundary.from.mock.calls).toEqual([["projects"], ["people"], ["categories"]]);
      expect(tables.projects.query.select).toHaveBeenCalledExactlyOnceWith("id,name,hemisphere");
      expect(tables.projects.query.eq).toHaveBeenCalledExactlyOnceWith("id", PROJECT_ID);
      expect(tables.projects.query.maybeSingle).toHaveBeenCalledExactlyOnceWith();
      expect(tables.people.query.select).toHaveBeenCalledExactlyOnceWith("id,project_id,name,kind");
      expect(tables.people.query.eq).toHaveBeenCalledExactlyOnceWith("project_id", PROJECT_ID);
      expect(tables.people.query.order).toHaveBeenCalledExactlyOnceWith("name");
      expect(tables.categories.query.select).toHaveBeenCalledExactlyOnceWith("id,project_id,name,color");
      expect(tables.categories.query.eq).toHaveBeenCalledExactlyOnceWith("project_id", PROJECT_ID);
      expect(tables.categories.query.order).toHaveBeenCalledExactlyOnceWith("position");
    });

    it("returns an unavailable project rather than a successful empty workspace", async () => {
      tables.projects.result.data = null;

      await expectJson(await projectGET(new Request(`${ORIGIN}/api/projects/${PROJECT_ID}`), context()), 404, {
        error: "Project is unavailable.",
      });
    });

    it.each<Table>(["projects", "people", "categories"])("does not suppress the %s detail query error", async (table) => {
      tables.projects.result.data = { id: PROJECT_ID };
      tables[table].result.error = { code: "42501", message: "Fictional private provider detail" };

      await expectJson(await projectGET(new Request(`${ORIGIN}/api/projects/${PROJECT_ID}`), context()), 403, {
        error: "This project or event is unavailable.",
      });
    });

    it.each([
      { route: "detail", run: () => projectGET(new Request(`${ORIGIN}/api/projects/invalid`), context("invalid")) },
      { route: "timeline", run: () => eventsGET(new Request(`${ORIGIN}/api/projects/invalid/events`), context("invalid")) },
      { route: "person", run: () => personPOST(writeRequest("/api/projects/invalid/people", "{"), context("invalid")) },
      { route: "event", run: () => eventPOST(writeRequest("/api/projects/invalid/events", "{"), context("invalid")) },
    ])("rejects an invalid project identifier in the $route handler before provider access", async ({ run }) => {
      await expectJson(await run(), 404, { error: "Project is unavailable." });
      expect(boundary.createServerClient).not.toHaveBeenCalled();
      expect(boundary.rpc).not.toHaveBeenCalled();
    });

    it("normalizes a person mutation while deriving the project from the route, not the body", async () => {
      boundary.rpc.mockResolvedValue({ data: { id: PERSON_ID }, error: null });

      await expectJson(await personPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/people`, JSON.stringify(PERSON)), context(),
      ), 200, { id: PERSON_ID });
      expect(boundary.rpc).toHaveBeenCalledExactlyOnceWith("add_person", {
        p_project: PROJECT_ID, p_input: { ...PERSON, name: "Another character" },
      });
    });

    it.each([
      { ...PERSON, name: "   " },
      { ...PERSON, kind: "invited-account" },
      { ...PERSON, owner_id: USER.id },
      { ...PERSON, project_id: PROJECT_ID },
    ])("rejects invalid person fields instead of invoking a mutation: %j", async (input) => {
      const response = await personPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/people`, JSON.stringify(input)), context(),
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: expect.any(String) });
      expect(boundary.auth.getUser).not.toHaveBeenCalled();
      expect(boundary.rpc).not.toHaveBeenCalled();
    });

    it("preserves event request identity, expected version, associations, and ongoing precision at the RPC boundary", async () => {
      const acknowledged = { id: EVENT_ID, version: 4 };
      boundary.rpc.mockResolvedValue({ data: acknowledged, error: null });

      await expectJson(await eventPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/events`, JSON.stringify(EVENT)), context(),
      ), 200, acknowledged);
      expect(boundary.rpc).toHaveBeenCalledExactlyOnceWith("save_event", {
        p_project: PROJECT_ID,
        p_input: { ...EVENT, title: "Fictional departure", location: "Imaginary harbour" },
      });
    });

    it.each([
      { label: "empty title", input: { ...EVENT, title: "   " } },
      { label: "no participant", input: { ...EVENT, personIds: [] } },
      { label: "duplicate participant", input: { ...EVENT, personIds: [PERSON_ID, PERSON_ID] } },
      { label: "duplicate category", input: { ...EVENT, categoryIds: [CATEGORY_ID, CATEGORY_ID] } },
      { label: "negative version", input: { ...EVENT, version: -1 } },
      { label: "owner injection", input: { ...EVENT, owner_id: USER.id } },
      { label: "inverted date", input: { ...EVENT, date: { kind: "range", start: { year: 2025 }, end: { year: 2020 } } } },
    ])("rejects an event with $label before authentication or submission", async ({ input }) => {
      const response = await eventPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/events`, JSON.stringify(input)), context(),
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: expect.any(String) });
      expect(boundary.auth.getUser).not.toHaveBeenCalled();
      expect(boundary.rpc).not.toHaveBeenCalled();
    });

    it.each([
      { code: "P0001", message: "This event changed elsewhere.", status: 409, error: "This event changed elsewhere." },
      { code: "42501", message: "Fictional ownership detail", status: 403, error: "This project or event is unavailable." },
      { code: "22023", message: "Choose people from this project.", status: 400, error: "Choose people from this project." },
      ...["23514", "23502", "22008", "22007", "22P02"].map((code) => ({
        code, message: "Fictional database detail", status: 400,
        error: "Check the event fields and dates, then try again.",
      })),
      { code: "08006", message: "Fictional credential and query details", status: 503,
        error: "The database request failed. Your draft has been kept; please retry." },
    ])("maps database error $code without acknowledging an event save", async ({ code, message, status, error }) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      boundary.rpc.mockResolvedValue({ data: null, error: { code, message } });

      await expectJson(await eventPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/events`, JSON.stringify(EVENT)), context(),
      ), status, { error });
      if (status === 503) {
        expect(log).toHaveBeenCalledExactlyOnceWith("Database request failed", { code });
      } else {
        expect(log).not.toHaveBeenCalled();
      }
    });

    it("redacts an unexpected provider exception and does not report a saved event", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      boundary.rpc.mockRejectedValue(new TypeError("Fictional private request/token detail"));

      await expectJson(await eventPOST(
        writeRequest(`/api/projects/${PROJECT_ID}/events`, JSON.stringify(EVENT)), context(),
      ), 500, { error: "The request failed. Please retry; your draft has not been submitted." });
      expect(log).toHaveBeenCalledExactlyOnceWith("Unexpected API failure", { type: "TypeError" });
    });

    it("combines participant/category selections, escaped search, overlap dates, and pagination in one scoped query", async () => {
      const events = [{ id: EVENT_ID, title: "Fictional harbour" }];
      tables.events.result.data = events;
      const params = new URLSearchParams([
        ["person", PERSON_ID], ["person", OTHER_PERSON_ID], ["category", CATEGORY_ID],
        ["q", "  harbour%_  "], ["from", "2020-06-01"], ["to", "2021-08-31"],
        ["undated", "false"], ["offset", "50"],
      ]);

      await expectJson(await eventsGET(
        new Request(`${ORIGIN}/api/projects/${PROJECT_ID}/events?${params}`), context(),
      ), 200, { events, hasMore: false });
      const query = tables.events.query;
      expect(boundary.from).toHaveBeenCalledExactlyOnceWith("events");
      expect(query.select).toHaveBeenCalledExactlyOnceWith("*");
      expect(query.eq).toHaveBeenCalledExactlyOnceWith("project_id", PROJECT_ID);
      expect(query.overlaps.mock.calls).toEqual([
        ["person_ids", [PERSON_ID, OTHER_PERSON_ID]], ["category_ids", [CATEGORY_ID]],
      ]);
      expect(query.or).toHaveBeenCalledExactlyOnceWith(
        String.raw`and(or(title.ilike."%harbour\%\_%",description.ilike."%harbour\%\_%",location.ilike."%harbour\%\_%"),and(start_date.not.is.null,or(end_date.is.null,end_date.gte.2020-06-01),start_date.lte.2021-08-31))`,
      );
      expect(query.order.mock.calls).toEqual([
        ["start_date", { ascending: true, nullsFirst: false }], ["id"],
      ]);
      expect(query.range).toHaveBeenCalledExactlyOnceWith(50, 99);
    });

    it("includes Undated by default and reports another page only at the configured page boundary", async () => {
      const events = Array.from({ length: 50 }, (_, index) => ({ id: `fictional-event-${index}` }));
      tables.events.result.data = events;

      await expectJson(await eventsGET(
        new Request(`${ORIGIN}/api/projects/${PROJECT_ID}/events`), context(),
      ), 200, { events, hasMore: true });
      expect(tables.events.query.or).toHaveBeenCalledExactlyOnceWith(
        "and(or(and(start_date.not.is.null),start_date.is.null))",
      );
      expect(tables.events.query.range).toHaveBeenCalledExactlyOnceWith(0, 49);
    });

    it("fetches a single requested event inside the route project without applying page or timeline filters", async () => {
      const events = [{ id: EVENT_ID }];
      tables.events.result.data = events;

      await expectJson(await eventsGET(
        new Request(`${ORIGIN}/api/projects/${PROJECT_ID}/events?event=${EVENT_ID}&person=invalid&q=ignored`),
        context(),
      ), 200, { events, hasMore: false });
      expect(tables.events.query.eq.mock.calls).toEqual([["project_id", PROJECT_ID], ["id", EVENT_ID]]);
      expect(tables.events.query.overlaps).not.toHaveBeenCalled();
      expect(tables.events.query.or).not.toHaveBeenCalled();
      expect(tables.events.query.range).not.toHaveBeenCalled();
    });

    it.each([
      { query: "offset=-1", error: "Invalid page." },
      { query: "offset=1.5", error: "Invalid page." },
      { query: "offset=1000001", error: "Invalid page." },
      { query: "event=invalid", error: "Invalid event." },
      { query: "person=invalid", error: "Invalid timeline filter." },
      { query: `category=${CATEGORY_ID}&category=invalid`, error: "Invalid timeline filter." },
      { query: new URLSearchParams(Array.from({ length: 51 }, () => ["person", PERSON_ID])).toString(),
        error: "Invalid timeline filter." },
      { query: `q=${"a".repeat(201)}`, error: "Search is too long." },
      { query: "from=2023-02-29", error: "Choose a valid date filter." },
      { query: "to=2024-13-01", error: "Choose a valid date filter." },
      { query: "from=2024-05-01&to=2024-04-30", error: "Choose a valid date filter." },
    ])("rejects invalid timeline arguments: $query", async ({ query, error }) => {
      await expectJson(await eventsGET(
        new Request(`${ORIGIN}/api/projects/${PROJECT_ID}/events?${query}`), context(),
      ), 400, { error });
      expect(tables.events.query.range).not.toHaveBeenCalled();
      expect(boundary.rpc).not.toHaveBeenCalled();
    });

    it.each(["", `?event=${EVENT_ID}`])("does not turn a timeline query error into an empty success (%s)", async (query) => {
      tables.events.result.error = { code: "42501", message: "Fictional private provider detail" };

      await expectJson(await eventsGET(
        new Request(`${ORIGIN}/api/projects/${PROJECT_ID}/events${query}`), context(),
      ), 403, { error: "This project or event is unavailable." });
    });
  });

  it("does not claim recovery email delivery after an SMTP error", async () => {
    boundary.auth.resetPasswordForEmail.mockResolvedValue(failedAuth(500, "Fictional SMTP unavailable"));

    await expectJson(await account("reset", { email: USER.email }), 400, {
      error: "The email could not be sent. Please wait and try again.",
    });
    expect(boundary.auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith(USER.email, {
      redirectTo: `${ORIGIN}/api/auth/callback?flow=recovery`,
    });
  });

  it("preserves resend rate limiting without claiming an email was sent", async () => {
    boundary.auth.resend.mockResolvedValue(failedAuth(429, "Fictional mail rate limit"));

    await expectJson(await account("resend", { email: USER.email }), 429, {
      error: "The email could not be sent. Please wait and try again.",
    });
    expect(boundary.auth.resend).toHaveBeenCalledExactlyOnceWith({
      type: "signup", email: USER.email,
      options: { emailRedirectTo: `${ORIGIN}/api/auth/callback` },
    });
  });

  it("exchanges PKCE codes, forwards cookie writes with production flags, and fixes the redirect", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const incoming = [{ name: "fictional-verifier", value: "fictional-verifier-value" }];
    boundary.jar.getAll.mockReturnValue(incoming);
    boundary.auth.exchangeCodeForSession.mockImplementation(async () => {
      const options = clientOptions();
      expect(await options.cookies.getAll()).toEqual(incoming);
      if (!options.cookies.setAll) throw new Error("Expected the real helper's cookie writer.");
      await options.cookies.setAll([{
        name: "fictional-session", value: "fictional-session-value",
        options: { path: "/", maxAge: 3600, httpOnly: false, secure: false, sameSite: "none" },
      }], {});
      return { data: { user: USER }, error: null };
    });

    const response = await callbackGET(new Request(
      `${ORIGIN}/api/auth/callback?code=fictional-code&next=https%3A%2F%2Fforeign.example.test`,
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/projects`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(boundary.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("fictional-code");
    expect(boundary.auth.verifyOtp).not.toHaveBeenCalled();
    expect(clientOptions().cookieOptions).toEqual({
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
    });
    // This fake proves adapter calls and flags, not actual Next HTTP Set-Cookie propagation.
    expect(boundary.jar.set).toHaveBeenCalledExactlyOnceWith("fictional-session", "fictional-session-value", {
      path: "/", maxAge: 3600, httpOnly: true, secure: true, sameSite: "lax",
    });
  });

  it("verifies recovery hashes and permits non-Secure development cookie writes", async () => {
    boundary.auth.verifyOtp.mockImplementation(async () => {
      const options = clientOptions();
      if (!options.cookies.setAll) throw new Error("Expected the real helper's cookie writer.");
      await options.cookies.setAll([{
        name: "fictional-recovery", value: "fictional-recovery-value",
        options: { path: "/", httpOnly: false, secure: true, sameSite: "none" },
      }], {});
      return { data: { user: USER }, error: null };
    });

    const response = await callbackGET(new Request(
      `${ORIGIN}/api/auth/callback?token_hash=fictional-hash&type=recovery`,
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/account?mode=password`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(boundary.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: "fictional-hash", type: "recovery",
    });
    expect(boundary.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(boundary.jar.set).toHaveBeenCalledExactlyOnceWith("fictional-recovery", "fictional-recovery-value", {
      path: "/", httpOnly: true, secure: false, sameSite: "lax",
    });
  });

  it("turns an invalid token result into a private fixed expired-link redirect", async () => {
    boundary.auth.verifyOtp.mockResolvedValue(failedAuth(403, "Fictional expired token detail"));

    const response = await callbackGET(new Request(
      `${ORIGIN}/api/auth/callback?token_hash=fictional-invalid-hash&type=signup`,
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/account?notice=expired`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(boundary.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: "fictional-invalid-hash", type: "signup",
    });
    expect(boundary.jar.set).not.toHaveBeenCalled();
  });

  it("does not send unsupported token types to the verification boundary", async () => {
    const response = await callbackGET(new Request(
      `${ORIGIN}/api/auth/callback?token_hash=fictional-hash&type=invite`,
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/account?notice=expired`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(boundary.auth.verifyOtp).not.toHaveBeenCalled();
    expect(boundary.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
