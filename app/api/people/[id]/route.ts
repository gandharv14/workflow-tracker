import { NextResponse } from "next/server";

import { deletePerson, updatePerson } from "@/lib/store";
import { updatePersonSchema } from "@/lib/schemas";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updatePersonSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await updatePerson(id, {
    email: parsed.data.email,
    name: parsed.data.name as string | null | undefined,
    role: parsed.data.role as string | null | undefined,
    step: parsed.data.step as Step | undefined,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "A person with that email already exists" },
      { status: 409 },
    );
  }

  return NextResponse.json(result.person);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const result = await deletePerson(id);
  if (!result.ok) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
