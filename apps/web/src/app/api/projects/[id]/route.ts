import { api, backend } from "@/lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    return backend.getProject(id);
  });
}
