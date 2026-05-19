import { NextResponse } from "next/server";

import {
  DEFAULT_PROJECT_ID,
  PROJECT_QUERY_PARAM,
  normalizeProjectId,
  type ProjectId,
} from "./projects";

export function projectIdOrResponse(
  request?: Request,
): { projectId: ProjectId; response: null } | { projectId: null; response: NextResponse } {
  if (!request) return { projectId: DEFAULT_PROJECT_ID, response: null };
  const params = new URL(request.url).searchParams;
  if (!params.has(PROJECT_QUERY_PARAM)) {
    return { projectId: DEFAULT_PROJECT_ID, response: null };
  }
  const projectId = normalizeProjectId(params.get(PROJECT_QUERY_PARAM));
  if (projectId) return { projectId, response: null };
  return {
    projectId: null,
    response: NextResponse.json({ error: "Unknown project" }, { status: 400 }),
  };
}
