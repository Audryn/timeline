import { api, backend } from "@/lib/server";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return api(request, async () => {
    const { action } = await context.params;
    return backend.accountAction(request, action);
  });
}
