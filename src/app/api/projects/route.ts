import { projectInputSchema } from "@/domain/models";
import { api, authenticated, body, databaseError } from "@/lib/server";

export async function GET(request: Request) {
  return api(request, async () => {
    const { client } = await authenticated();
    const { data, error } = await client.from("projects").select("id,name,hemisphere").order("created_at", { ascending: false }).limit(100);
    if (error) databaseError(error);
    return data;
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(request, projectInputSchema);
    const { client } = await authenticated();
    const { data, error } = await client.rpc("create_project", { p_input: input });
    if (error) databaseError(error);
    return data;
  });
}
