import { projectQuery, type ProjectId } from "./projects";
import type { Step } from "./steps";
import type { Person } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

function peoplePath(projectId: ProjectId, suffix = ""): string {
  return `/api/people${suffix}?${projectQuery(projectId)}`;
}

export async function fetchPeople(projectId: ProjectId): Promise<Person[]> {
  const res = await fetch(peoplePath(projectId), { cache: "no-store" });
  return handle<Person[]>(res);
}

export async function createPerson(
  projectId: ProjectId,
  input: {
    email: string;
    name?: string;
    role?: string;
    step?: Step;
  },
): Promise<Person> {
  const res = await fetch(peoplePath(projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<Person>(res);
}

export async function patchPerson(
  projectId: ProjectId,
  id: string,
  patch: { email?: string; name?: string | null; role?: string | null; step?: Step },
): Promise<Person> {
  const res = await fetch(peoplePath(projectId, `/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<Person>(res);
}

export async function deletePersonRequest(
  projectId: ProjectId,
  id: string,
): Promise<void> {
  const res = await fetch(peoplePath(projectId, `/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
  if (res.status === 404) return;
  if (!res.ok) await handle<unknown>(res);
}

export async function bulkRequest(
  projectId: ProjectId,
  input: {
    action: "move" | "delete";
    ids: string[];
    step?: Step;
  },
): Promise<{ updated?: Person[]; deleted?: number }> {
  const res = await fetch(peoplePath(projectId, "/bulk"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<{ updated?: Person[]; deleted?: number }>(res);
}

export async function importPeopleRequest(
  projectId: ProjectId,
  input: {
    people: Array<{
      email: string;
      name?: string;
      role?: string;
      step?: Step;
      fields?: { name?: boolean; role?: boolean; step?: boolean };
    }>;
  },
): Promise<{ created: number; updated: number; people: Person[] }> {
  const res = await fetch(peoplePath(projectId, "/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<{ created: number; updated: number; people: Person[] }>(res);
}

export async function sendSentContractsEmailRequest(
  projectId: ProjectId,
): Promise<{ sent: number }> {
  const res = await fetch(peoplePath(projectId, "/sent-contracts-email"), {
    method: "POST",
  });
  return handle<{ sent: number }>(res);
}
