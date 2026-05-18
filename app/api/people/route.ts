import { NextResponse } from "next/server";

import { addPerson, listPeople } from "@/lib/store";
import { createPersonSchema } from "@/lib/schemas";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

export async function GET() {
  const people = await listPeople();
  return NextResponse.json(people);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPersonSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await addPerson({
    email: parsed.data.email,
    name: parsed.data.name,
    step: parsed.data.step as Step | undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "A person with that email already exists" },
      { status: 409 },
    );
  }

  return NextResponse.json(result.person, { status: 201 });
}
