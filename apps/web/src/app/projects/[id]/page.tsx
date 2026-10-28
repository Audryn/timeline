import { Workspace } from "@/features/timeline/workspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace key={id} projectId={id} />;
}
