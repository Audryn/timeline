import { z } from "zod";
import { api, ApiError, authenticated, databaseError } from "@/lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Project is unavailable.");
    const { client } = await authenticated();
    const [project, people, categories] = await Promise.all([
      client.from("projects").select("id,name,hemisphere").eq("id", id).maybeSingle(),
      client.from("people").select("id,project_id,name,kind").eq("project_id", id).order("name"),
      client.from("categories").select("id,project_id,name,color").eq("project_id", id).order("position"),
    ]);
    for (const result of [project, people, categories]) if (result.error) databaseError(result.error);
    if (!project.data) throw new ApiError(404, "Project is unavailable.");
    return { project: project.data, people: people.data, categories: categories.data };
  });
}
