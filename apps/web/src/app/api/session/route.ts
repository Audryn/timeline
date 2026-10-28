import { api, backend } from "@/lib/server";

export async function GET(request: Request) {
  return api(request, () => backend.session());
}
