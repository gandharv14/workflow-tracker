import { NextResponse } from "next/server";

import { StoreDataError, StoreInputError, StoreWriteConflictError } from "./store";

export function routeErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof StoreInputError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (err instanceof StoreWriteConflictError) {
    return NextResponse.json(
      { error: "Workflow data changed while saving. Please retry." },
      { status: 409 },
    );
  }

  if (err instanceof StoreDataError) {
    return NextResponse.json(
      { error: "Stored workflow data is invalid and must be repaired." },
      { status: 503 },
    );
  }

  if (err instanceof Error && err.name.startsWith("Blob")) {
    return NextResponse.json(
      { error: "Workflow storage is temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }

  return null;
}

