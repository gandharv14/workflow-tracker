import type { Step } from "./steps";

export const CC_AGENTIC_CODING_TAIGA_PROJECT_ID = "cc-agentic-coding-taiga";
export const TRANSCRIPT_CONSENSUS_PROJECT_ID = "transcript-consensus";

export const PROJECTS = [
  {
    id: CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
    name: "CC-Agentic-Coding-Taiga",
    description: "Full candidate workflow",
    steps: [
      "eval",
      "interview",
      "background_check",
      "sent_contracts",
      "in_production",
    ] satisfies Step[],
    canEmailSentContracts: true,
  },
  {
    id: TRANSCRIPT_CONSENSUS_PROJECT_ID,
    name: "Transcript Consensus",
    description: "Consensus workflow without interviews or contracts",
    steps: ["eval", "background_check", "in_production"] satisfies Step[],
    canEmailSentContracts: false,
  },
] as const;

export type ProjectId = (typeof PROJECTS)[number]["id"];
export type Project = (typeof PROJECTS)[number];

export const DEFAULT_PROJECT_ID: ProjectId = CC_AGENTIC_CODING_TAIGA_PROJECT_ID;
export const PROJECT_QUERY_PARAM = "project";

const PROJECTS_BY_ID = new Map<ProjectId, Project>(
  PROJECTS.map((project) => [project.id, project]),
);

export function isProjectId(value: unknown): value is ProjectId {
  return (
    typeof value === "string" &&
    PROJECTS.some((project) => project.id === value)
  );
}

export function normalizeProjectId(value: unknown): ProjectId | null {
  if (isProjectId(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isProjectId(normalized) ? normalized : null;
}

export function resolveProjectId(value: unknown): ProjectId {
  return normalizeProjectId(value) ?? DEFAULT_PROJECT_ID;
}

export function getProject(projectId: ProjectId): Project {
  return PROJECTS_BY_ID.get(projectId) ?? PROJECTS_BY_ID.get(DEFAULT_PROJECT_ID)!;
}

export function projectIdFromUrl(url: string): ProjectId | null {
  return normalizeProjectId(new URL(url).searchParams.get(PROJECT_QUERY_PARAM));
}

export function projectQuery(projectId: ProjectId): string {
  return `${PROJECT_QUERY_PARAM}=${encodeURIComponent(projectId)}`;
}
