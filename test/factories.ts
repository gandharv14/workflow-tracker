import type { Step } from "@/lib/steps";
import type { Person } from "@/lib/types";

export function person(overrides: Partial<Person> = {}): Person {
  const id = overrides.id ?? "person-1";
  const now = overrides.updatedAt ?? "2026-01-01T00:00:00.000Z";
  return {
    id,
    email: overrides.email ?? `${id}@example.com`,
    name: overrides.name,
    step: overrides.step ?? ("eval" satisfies Step),
    createdAt: overrides.createdAt ?? now,
    updatedAt: now,
  };
}
