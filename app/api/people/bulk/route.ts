import { NextResponse } from "next/server";

import { bulkDelete, bulkMove } from "@/lib/store";
import { bulkSchema } from "@/lib/schemas";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bulkSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "move") {
    const { updated } = await bulkMove(
      parsed.data.ids,
      parsed.data.step as Step,
    );
    return NextResponse.json({ updated });
  }

  const { deleted } = await bulkDelete(parsed.data.ids);
  return NextResponse.json({ deleted });
}
