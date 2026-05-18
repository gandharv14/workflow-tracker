import { NextResponse } from "next/server";

import { importPeople } from "@/lib/store";
import { importPeopleSchema } from "@/lib/schemas";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = importPeopleSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await importPeople(
    parsed.data.people.map((person) => ({
      email: person.email,
      name: person.name,
      role: person.role,
      step: person.step as Step | undefined,
    })),
  );

  return NextResponse.json(result);
}
