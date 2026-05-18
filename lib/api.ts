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

export async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people", { cache: "no-store" });
  return handle<Person[]>(res);
}

export async function createPerson(input: {
  email: string;
  name?: string;
  role?: string;
  step?: Step;
}): Promise<Person> {
  const res = await fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<Person>(res);
}

export async function patchPerson(
  id: string,
  patch: { email?: string; name?: string | null; role?: string | null; step?: Step },
): Promise<Person> {
  const res = await fetch(`/api/people/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<Person>(res);
}

export async function deletePersonRequest(id: string): Promise<void> {
  const res = await fetch(`/api/people/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.status === 404) return;
  if (!res.ok) await handle<unknown>(res);
}

export async function bulkRequest(input: {
  action: "move" | "delete";
  ids: string[];
  step?: Step;
}): Promise<{ updated?: Person[]; deleted?: number }> {
  const res = await fetch(`/api/people/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<{ updated?: Person[]; deleted?: number }>(res);
}

export async function importPeopleRequest(input: {
  people: Array<{ email: string; name?: string; role?: string; step?: Step }>;
}): Promise<{ created: number; updated: number; people: Person[] }> {
  const res = await fetch(`/api/people/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<{ created: number; updated: number; people: Person[] }>(res);
}
