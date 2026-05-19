import { NextResponse } from "next/server";

import { importPeople } from "@/lib/store";
import { importPeopleSchemaForProject } from "@/lib/schemas";
import { projectIdOrResponse } from "@/lib/project-api";
import { routeErrorResponse } from "@/lib/route-errors";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

function hasOwnField(value: unknown, field: "name" | "role" | "step"): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, field)
  );
}

function rawPeopleFromPayload(payload: unknown): unknown[] {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "people" in payload &&
    Array.isArray(payload.people)
  ) {
    return payload.people;
  }
  return [];
}

export async function POST(request: Request) {
  const { projectId, response } = projectIdOrResponse(request);
  if (response) return response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = importPeopleSchemaForProject(projectId).safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof importPeople>>;
  try {
    const rawPeople = rawPeopleFromPayload(payload);
    result = await importPeople(
      parsed.data.people.map((person, index) => ({
        email: person.email,
        name: person.name,
        role: person.role,
        step: person.step as Step | undefined,
        fields: {
          name: person.fields?.name ?? hasOwnField(rawPeople[index], "name"),
          role: person.fields?.role ?? hasOwnField(rawPeople[index], "role"),
          step: person.fields?.step ?? hasOwnField(rawPeople[index], "step"),
        },
      })),
      projectId,
    );
  } catch (err) {
    const response = routeErrorResponse(err);
    if (response) return response;
    throw err;
  }

  return NextResponse.json(result);
}
