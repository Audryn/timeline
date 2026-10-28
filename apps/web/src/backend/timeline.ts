import { z } from "zod";
import { eventInputSchema, personInputSchema, projectInputSchema } from "@/domain/models";
import { timelineLogic } from "@/domain/filters";
import { ApiError, authenticated, body, databaseError, type BackendDependencies } from "./core";

function projectId(id: string) {
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Project is unavailable.");
}

export async function listProjects(dependencies: BackendDependencies) {
  const { client } = await authenticated(dependencies.createClient);
  const { data, error } = await client.from("projects").select("id,name,hemisphere").order("created_at", { ascending: false }).limit(100);
  if (error) databaseError(error);
  return data;
}

export async function createProject(request: Request, dependencies: BackendDependencies) {
  const input = await body(request, projectInputSchema);
  const { client } = await authenticated(dependencies.createClient);
  const { data, error } = await client.rpc("create_project", { p_input: input });
  if (error) databaseError(error);
  return data;
}

export async function getProject(id: string, dependencies: BackendDependencies) {
  projectId(id);
  const { client } = await authenticated(dependencies.createClient);
  const [project, people, categories] = await Promise.all([
    client.from("projects").select("id,name,hemisphere").eq("id", id).maybeSingle(),
    client.from("people").select("id,project_id,name,kind").eq("project_id", id).order("name"),
    client.from("categories").select("id,project_id,name,color").eq("project_id", id).order("position"),
  ]);
  for (const result of [project, people, categories]) if (result.error) databaseError(result.error);
  if (!project.data) throw new ApiError(404, "Project is unavailable.");
  return { project: project.data, people: people.data, categories: categories.data };
}

export async function addPerson(request: Request, id: string, dependencies: BackendDependencies) {
  projectId(id);
  const input = await body(request, personInputSchema);
  const { client } = await authenticated(dependencies.createClient);
  const { data, error } = await client.rpc("add_person", { p_project: id, p_input: input });
  if (error) databaseError(error);
  return data;
}

export async function listEvents(request: Request, id: string, dependencies: BackendDependencies) {
  projectId(id);
  const params = new URL(request.url).searchParams;
  const parsedOffset = z.coerce.number().int().min(0).max(1000000).safeParse(params.get("offset") ?? 0);
  if (!parsedOffset.success) throw new ApiError(400, "Invalid page.");
  const offset = parsedOffset.data;
  const { client } = await authenticated(dependencies.createClient);
  let query = client.from("events").select("*").eq("project_id", id);
  const eventId = params.get("event");
  if (eventId) {
    if (!z.uuid().safeParse(eventId).success) throw new ApiError(400, "Invalid event.");
    const { data, error } = await query.eq("id", eventId);
    if (error) databaseError(error);
    return { events: data, hasMore: false };
  }
  for (const [param, column] of [["person", "person_ids"], ["category", "category_ids"]] as const) {
    const values = params.getAll(param);
    if (values.length > 50 || values.some((value) => !z.uuid().safeParse(value).success)) throw new ApiError(400, "Invalid timeline filter.");
    if (values.length) query = query.overlaps(column, values);
  }
  const text = params.get("q")?.trim() ?? "";
  if (text.length > 200) throw new ApiError(400, "Search is too long.");
  const date = z.iso.date();
  const from = params.get("from");
  const to = params.get("to");
  if ((from && !date.safeParse(from).success) || (to && !date.safeParse(to).success) || (from && to && from > to)) {
    throw new ApiError(400, "Choose a valid date filter.");
  }
  query = query.or(timelineLogic({ text, from, to, undated: params.get("undated") !== "false" }));
  const { data, error } = await query.order("start_date", { ascending: true, nullsFirst: false }).order("id").range(offset, offset + 49);
  if (error) databaseError(error);
  return { events: data, hasMore: data?.length === 50 };
}

export async function saveEvent(request: Request, id: string, dependencies: BackendDependencies) {
  projectId(id);
  const input = await body(request, eventInputSchema);
  const { client } = await authenticated(dependencies.createClient);
  const { data, error } = await client.rpc("save_event", { p_project: id, p_input: input });
  if (error) databaseError(error);
  return data;
}
