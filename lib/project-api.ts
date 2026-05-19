import { NextResponse } from "next/server";

import { projectIdFromUrl, type ProjectId } from "./projects";

export function projectIdOrResponse(
  request: Request,
): { projectId: ProjectId; response: null } | { projectId: null; response: NextResponse } {
  const projectId = projectIdFromUrl(request.url);
  if (projectId) return { projectId, response: null };
  return {
    projectId: null,
    response: NextResponse.json({ error: "Unknown project" }, { status: 400 }),
  };
}
