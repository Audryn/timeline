import { api, backend } from "@/lib/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => {
    const { id } = await context.params;
    return backend.addPerson(request, id);
  });
}
