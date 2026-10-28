import { z } from "zod";
import { eventInputSchema } from "@/domain/models";
import { timelineLogic } from "@/domain/filters";
import { api, ApiError, authenticated, body, databaseError } from "@/lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Project is unavailable.");
    const params = new URL(request.url).searchParams;
    const parsedOffset = z.coerce.number().int().min(0).max(1000000).safeParse(params.get("offset") ?? 0);
    if (!parsedOffset.success) throw new ApiError(400, "Invalid page.");
    const offset = parsedOffset.data;
    const { client } = await authenticated();
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
  });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Project is unavailable.");
    const input = await body(request, eventInputSchema);
    const { client } = await authenticated();
    const { data, error } = await client.rpc("save_event", { p_project: id, p_input: input });
    if (error) databaseError(error);
    return data;
  });
}
