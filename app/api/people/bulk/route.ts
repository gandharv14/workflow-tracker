import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import { bulkDelete, bulkMove } from "@/lib/store";
import { bulkSchema } from "@/lib/schemas";
import { routeErrorResponse } from "@/lib/route-errors";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResponse = await requireApiAuth();
  if (authResponse) return authResponse;

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
    try {
      const { updated } = await bulkMove(
        parsed.data.ids,
        parsed.data.step as Step,
      );
      return NextResponse.json({ updated });
    } catch (err) {
      const response = routeErrorResponse(err);
      if (response) return response;
      throw err;
    }
  }

  try {
    const { deleted } = await bulkDelete(parsed.data.ids);
    return NextResponse.json({ deleted });
  } catch (err) {
    const response = routeErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
