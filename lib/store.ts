import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  head,
  put,
} from "@vercel/blob";
import { nanoid } from "nanoid";
import { basename, join } from "node:path";

import { normalizeStep, type Step } from "./steps";
import type { Person } from "./types";

const BLOB_KEY = "people.json";
const MAX_RETRIES = 3;

type StoreSnapshot = { people: Person[]; etag: string | null };

// Serialize all reads/writes through a single in-process promise chain so we
// can never observe a half-written response or interleave updates inside one
// runtime instance. ETag-based conditional writes guard cross-instance races.
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

function parsePeople(raw: string): Person[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as Person[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((person) => ({
      ...person,
      name: normalizeOptionalText(person.name),
      role: normalizeOptionalText(person.role),
      step: normalizeStep(person.step) ?? "eval",
    }));
  } catch {
    return [];
  }
}

function shouldUseFileStore(): boolean {
  return process.env.WORKFLOW_TRACKER_STORE === "file";
}

function fileStorePath(): string {
  const fileName = basename(
    process.env.WORKFLOW_TRACKER_STORE_FILE ?? ".workflow-tracker-store.json",
  );
  return join(
    /*turbopackIgnore: true*/ process.cwd(),
    "test-results",
    fileName,
  );
}

async function readFileStore(): Promise<StoreSnapshot> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return { people: parsePeople(raw), etag: null };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return { people: [], etag: null };
    }
    throw err;
  }
}

async function writeFileStore(people: Person[]): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const target = fileStorePath();
  await mkdir(join(process.cwd(), "test-results"), { recursive: true });
  await writeFile(target, JSON.stringify(people, null, 2) + "\n", "utf8");
}

async function readBlobStore(): Promise<StoreSnapshot> {
  let meta;
  try {
    meta = await head(BLOB_KEY);
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return { people: [], etag: null };
    }
    throw err;
  }
  const res = await fetch(meta.downloadUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to read blob: ${res.status} ${res.statusText}`);
  }
  const raw = await res.text();
  return { people: parsePeople(raw), etag: meta.etag };
}

async function writeBlobStore(
  people: Person[],
  etag: string | null,
): Promise<void> {
  const payload = JSON.stringify(people, null, 2) + "\n";
  await put(BLOB_KEY, payload, {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

async function readAll(): Promise<StoreSnapshot> {
  return shouldUseFileStore() ? readFileStore() : readBlobStore();
}

async function writeAll(people: Person[], etag: string | null): Promise<void> {
  if (shouldUseFileStore()) {
    await writeFileStore(people);
    return;
  }
  await writeBlobStore(people, etag);
}

async function mutate<T>(
  fn: (people: Person[]) => Promise<{ next: Person[] | null; result: T }>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const { people, etag } = await readAll();
    const { next, result } = await fn(people);
    if (next === null) return result;
    try {
      await writeAll(next, etag);
      return result;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("Exceeded blob write retries");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function listPeople(): Promise<Person[]> {
  return withLock(async () => (await readAll()).people);
}

type AddPersonResult =
  | { ok: true; person: Person }
  | { ok: false; reason: "duplicate_email" };

export function addPerson(input: {
  email: string;
  name?: string;
  role?: string;
  step?: Step;
}): Promise<AddPersonResult> {
  return withLock(() =>
    mutate<AddPersonResult>(async (people) => {
      const email = normalizeEmail(input.email);
      if (people.some((p) => p.email === email)) {
        return {
          next: null,
          result: { ok: false, reason: "duplicate_email" },
        };
      }
      const now = new Date().toISOString();
      const step = normalizeStep(input.step) ?? "eval";
      const person: Person = {
        id: nanoid(10),
        email,
        name: normalizeOptionalText(input.name),
        role: normalizeOptionalText(input.role),
        step,
        createdAt: now,
        updatedAt: now,
      };
      return {
        next: [...people, person],
        result: { ok: true, person },
      };
    }),
  );
}

type UpdatePersonResult =
  | { ok: true; person: Person }
  | { ok: false; reason: "not_found" | "duplicate_email" };

export function updatePerson(
  id: string,
  patch: { email?: string; name?: string | null; role?: string | null; step?: Step },
): Promise<UpdatePersonResult> {
  return withLock(() =>
    mutate<UpdatePersonResult>(async (people) => {
      const idx = people.findIndex((p) => p.id === id);
      if (idx === -1) {
        return {
          next: null,
          result: { ok: false, reason: "not_found" },
        };
      }

      const current = people[idx];
      const nextEmail =
        patch.email !== undefined ? normalizeEmail(patch.email) : current.email;
      if (
        patch.email !== undefined &&
        nextEmail !== current.email &&
        people.some((p) => p.email === nextEmail && p.id !== id)
      ) {
        return {
          next: null,
          result: { ok: false, reason: "duplicate_email" },
        };
      }

      const nextName =
        patch.name === null
          ? undefined
          : patch.name !== undefined
            ? normalizeOptionalText(patch.name)
            : current.name;

      const nextRole =
        patch.role === null
          ? undefined
          : patch.role !== undefined
            ? normalizeOptionalText(patch.role)
            : current.role;

      const updated: Person = {
        ...current,
        email: nextEmail,
        name: nextName,
        role: nextRole,
        step:
          patch.step !== undefined
            ? normalizeStep(patch.step) ?? current.step
            : current.step,
        updatedAt: new Date().toISOString(),
      };
      const nextPeople = people.slice();
      nextPeople[idx] = updated;
      return {
        next: nextPeople,
        result: { ok: true, person: updated },
      };
    }),
  );
}

export function deletePerson(id: string): Promise<{ ok: boolean }> {
  return withLock(() =>
    mutate<{ ok: boolean }>(async (people) => {
      const next = people.filter((p) => p.id !== id);
      if (next.length === people.length) {
        return { next: null, result: { ok: false } };
      }
      return { next, result: { ok: true } };
    }),
  );
}

export function bulkMove(
  ids: string[],
  step: Step,
): Promise<{ updated: Person[] }> {
  return withLock(() =>
    mutate(async (people) => {
      const targetStep = normalizeStep(step) ?? "eval";
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const updated: Person[] = [];
      const nextPeople = people.slice();
      let mutated = false;
      for (let i = 0; i < nextPeople.length; i += 1) {
        if (!idSet.has(nextPeople[i].id)) continue;
        if (nextPeople[i].step !== targetStep) {
          nextPeople[i] = { ...nextPeople[i], step: targetStep, updatedAt: now };
          mutated = true;
        }
        updated.push(nextPeople[i]);
      }
      return {
        next: mutated ? nextPeople : null,
        result: { updated },
      };
    }),
  );
}

export function bulkDelete(ids: string[]): Promise<{ deleted: number }> {
  return withLock(() =>
    mutate(async (people) => {
      const idSet = new Set(ids);
      const next = people.filter((p) => !idSet.has(p.id));
      const deleted = people.length - next.length;
      if (deleted === 0) {
        return { next: null, result: { deleted: 0 } };
      }
      return { next, result: { deleted } };
    }),
  );
}

type ImportPeopleInput = {
  email: string;
  name?: string;
  role?: string;
  step?: Step;
};

export function importPeople(
  inputs: ImportPeopleInput[],
): Promise<{ created: number; updated: number; people: Person[] }> {
  return withLock(() =>
    mutate(async (people) => {
      const now = new Date().toISOString();
      const nextPeople = people.slice();
      const indexByEmail = new Map(
        nextPeople.map((person, index) => [normalizeEmail(person.email), index]),
      );
      const changedPeople = new Map<string, Person>();
      let created = 0;
      let updated = 0;

      for (const input of inputs) {
        const email = normalizeEmail(input.email);
        const idx = indexByEmail.get(email);
        if (idx === undefined) {
          const person: Person = {
            id: nanoid(10),
            email,
            name: normalizeOptionalText(input.name),
            role: normalizeOptionalText(input.role),
            step: normalizeStep(input.step) ?? "eval",
            createdAt: now,
            updatedAt: now,
          };
          indexByEmail.set(email, nextPeople.length);
          nextPeople.push(person);
          changedPeople.set(email, person);
          created += 1;
          continue;
        }

        const current = nextPeople[idx];
        const updatedPerson: Person = {
          ...current,
          name: normalizeOptionalText(input.name),
          role: normalizeOptionalText(input.role),
          step:
            input.step !== undefined
              ? normalizeStep(input.step) ?? current.step
              : current.step,
          updatedAt: now,
        };
        nextPeople[idx] = updatedPerson;
        changedPeople.set(email, updatedPerson);
        updated += 1;
      }

      return {
        next: created > 0 || updated > 0 ? nextPeople : null,
        result: {
          created,
          updated,
          people: Array.from(changedPeople.values()),
        },
      };
    }),
  );
}
