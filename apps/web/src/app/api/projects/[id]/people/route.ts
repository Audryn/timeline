import { z } from "zod";
import { personInputSchema } from "@/domain/models";
import { api, ApiError, authenticated, body, databaseError } from "@/lib/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Project is unavailable.");
    const input = await body(request, personInputSchema);
    const { client } = await authenticated();
    const { data, error } = await client.rpc("add_person", { p_project: id, p_input: input });
    if (error) databaseError(error);
    return data;
  });
}
