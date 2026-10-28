import { api, backend } from "@/lib/server";

export async function GET(request: Request) {
  return api(request, () => backend.listProjects());
}

export async function POST(request: Request) {
  return api(request, () => backend.createProject(request));
}
