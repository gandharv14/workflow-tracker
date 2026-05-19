import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import { addPerson, listPeople } from "@/lib/store";
import { createPersonSchemaForProject } from "@/lib/schemas";
import { projectIdOrResponse } from "@/lib/project-api";
import { routeErrorResponse } from "@/lib/route-errors";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResponse = await requireApiAuth();
  if (authResponse) return authResponse;
  const { projectId, response } = projectIdOrResponse(request);
  if (response) return response;

  try {
    const people = await listPeople(projectId);
    return NextResponse.json(people);
  } catch (err) {
    const response = routeErrorResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function POST(request: Request) {
  const authResponse = await requireApiAuth();
  if (authResponse) return authResponse;
  const { projectId, response } = projectIdOrResponse(request);
  if (response) return response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPersonSchemaForProject(projectId).safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof addPerson>>;
  try {
    result = await addPerson({
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      step: parsed.data.step as Step | undefined,
    }, projectId);
  } catch (err) {
    const response = routeErrorResponse(err);
    if (response) return response;
    throw err;
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: "A person with that email already exists" },
      { status: 409 },
    );
  }

  return NextResponse.json(result.person, { status: 201 });
}
