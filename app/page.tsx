import { Board } from "@/components/board";
import { resolveProjectId, PROJECT_QUERY_PARAM } from "@/lib/projects";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawProject = params[PROJECT_QUERY_PARAM];
  const projectId = resolveProjectId(
    Array.isArray(rawProject) ? rawProject[0] : rawProject,
  );
  const people = await listPeople(projectId);
  return (
    <Board
      key={projectId}
      projectId={projectId}
      initialPeople={people}
    />
  );
}
