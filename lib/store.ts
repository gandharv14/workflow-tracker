import "server-only";

import {
  BlobError,
  BlobNotFoundError,
  BlobPreconditionFailedError,
  head,
  put,
} from "@vercel/blob";
import { nanoid } from "nanoid";
import { basename, join } from "node:path";

import {
  DEFAULT_PROJECT_ID,
  getProject,
  normalizeProjectId,
  type ProjectId,
} from "./projects";
import {
  getDefaultProjectStep,
  normalizeProjectStep,
  normalizeStep,
  type Step,
} from "./steps";
import type { Person } from "./types";

const BLOB_KEY = "people.json";
const MAX_RETRIES = 3;

type StoreSnapshot = { people: Person[]; etag: string | null };

export class StoreDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreDataError";
  }
}

export class StoreInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreInputError";
  }
}

export class StoreWriteConflictError extends Error {
  constructor(message = "The workflow data changed while saving. Please retry.") {
    super(message);
    this.name = "StoreWriteConflictError";
  }
}

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StoreDataError("Stored workflow data is not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new StoreDataError("Stored workflow data must be an array");
  }

  const seenEmails = new Set<string>();
  return parsed.map((value, index) => normalizePersistedPerson(value, index, seenEmails));
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
    allowOverwrite: etag !== null,
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
      if (isRetryableWriteConflict(err)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw new StoreWriteConflictError(
    lastError instanceof Error
      ? lastError.message
      : "The workflow data changed while saving. Please retry.",
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeInputStep(
  projectId: ProjectId,
  value: Step | undefined,
  fallback?: Step,
): Step {
  if (value === undefined) return fallback ?? getDefaultProjectStep(projectId);
  const step = normalizeProjectStep(projectId, value);
  if (step) return step;
  throw new StoreInputError(
    `Step is not valid for ${getProject(projectId).name}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizePersistedPerson(
  value: unknown,
  index: number,
  seenEmails: Set<string>,
): Person {
  if (!isRecord(value)) {
    throw new StoreDataError(`Stored workflow person at index ${index} is invalid`);
  }

  const id = value.id;
  const projectId = normalizeProjectId(value.projectId) ?? DEFAULT_PROJECT_ID;
  const emailValue = value.email;
  const createdAt = value.createdAt;
  const updatedAt = value.updatedAt;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new StoreDataError(`Stored workflow person at index ${index} is missing an id`);
  }
  if (typeof emailValue !== "string" || emailValue.trim().length === 0) {
    throw new StoreDataError(
      `Stored workflow person at index ${index} is missing an email`,
    );
  }
  if (!hasValidTimestamp(createdAt) || !hasValidTimestamp(updatedAt)) {
    throw new StoreDataError(
      `Stored workflow person at index ${index} has invalid timestamps`,
    );
  }

  const email = normalizeEmail(emailValue);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new StoreDataError(
      `Stored workflow person at index ${index} has an invalid email`,
    );
  }
  const emailKey = `${projectId}:${email}`;
  if (seenEmails.has(emailKey)) {
    throw new StoreDataError(
      `Stored workflow data has duplicate email ${email}`,
    );
  }
  seenEmails.add(emailKey);

  return {
    id: id.trim(),
    projectId,
    email,
    name: normalizeOptionalText(
      typeof value.name === "string" || value.name === null
        ? value.name
        : undefined,
    ),
    role: normalizeOptionalText(
      typeof value.role === "string" || value.role === null
        ? value.role
        : undefined,
    ),
    step:
      normalizeProjectStep(projectId, value.step) ??
      (projectId === DEFAULT_PROJECT_ID ? normalizeStep(value.step) : null) ??
      getDefaultProjectStep(projectId),
    createdAt,
    updatedAt,
  };
}

function isRetryableWriteConflict(err: unknown): boolean {
  if (err instanceof BlobPreconditionFailedError) return true;
  if (err instanceof BlobError) {
    return /precondition|already exists|conflict/i.test(err.message);
  }
  if (err && typeof err === "object") {
    const status = "status" in err ? err.status : undefined;
    if (status === 409 || status === 412) return true;
  }
  return err instanceof Error && /precondition|already exists|conflict/i.test(err.message);
}

export function listPeople(
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<Person[]> {
  return withLock(async () =>
    (await readAll()).people.filter((person) => person.projectId === projectId),
  );
}

type AddPersonResult =
  | { ok: true; person: Person }
  | { ok: false; reason: "duplicate_email" };

export function addPerson(input: {
  email: string;
  name?: string;
  role?: string;
  step?: Step;
}, projectId: ProjectId = DEFAULT_PROJECT_ID): Promise<AddPersonResult> {
  return withLock(() =>
    mutate<AddPersonResult>(async (people) => {
      const email = normalizeEmail(input.email);
      if (people.some((p) => p.projectId === projectId && p.email === email)) {
        return {
          next: null,
          result: { ok: false, reason: "duplicate_email" },
        };
      }
      const now = new Date().toISOString();
      const step = normalizeInputStep(projectId, input.step);
      const person: Person = {
        id: nanoid(10),
        projectId,
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
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<UpdatePersonResult> {
  return withLock(() =>
    mutate<UpdatePersonResult>(async (people) => {
      const idx = people.findIndex(
        (p) => p.projectId === projectId && p.id === id,
      );
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
        people.some(
          (p) =>
            p.projectId === projectId && p.email === nextEmail && p.id !== id,
        )
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
            ? normalizeInputStep(projectId, patch.step, current.step)
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

export function deletePerson(
  id: string,
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<{ ok: boolean }> {
  return withLock(() =>
    mutate<{ ok: boolean }>(async (people) => {
      const next = people.filter(
        (p) => !(p.projectId === projectId && p.id === id),
      );
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
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<{ updated: Person[] }> {
  return withLock(() =>
    mutate(async (people) => {
      const targetStep = normalizeInputStep(projectId, step);
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const updated: Person[] = [];
      const nextPeople = people.slice();
      let mutated = false;
      for (let i = 0; i < nextPeople.length; i += 1) {
        if (
          nextPeople[i].projectId !== projectId ||
          !idSet.has(nextPeople[i].id)
        ) {
          continue;
        }
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

export function bulkDelete(
  ids: string[],
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<{ deleted: number }> {
  return withLock(() =>
    mutate(async (people) => {
      const idSet = new Set(ids);
      const next = people.filter(
        (p) => p.projectId !== projectId || !idSet.has(p.id),
      );
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
  name?: string | null;
  role?: string | null;
  step?: Step;
  fields?: {
    name?: boolean;
    role?: boolean;
    step?: boolean;
  };
};

export function importPeople(
  inputs: ImportPeopleInput[],
  projectId: ProjectId = DEFAULT_PROJECT_ID,
): Promise<{ created: number; updated: number; people: Person[] }> {
  return withLock(() =>
    mutate(async (people) => {
      const now = new Date().toISOString();
      const nextPeople = people.slice();
      const indexByEmail = new Map(
        nextPeople
          .map((person, index) =>
            person.projectId === projectId
              ? ([normalizeEmail(person.email), index] as const)
              : null,
          )
          .filter((entry): entry is readonly [string, number] => entry !== null),
      );
      const changedPeople = new Map<string, Person>();
      let created = 0;
      let updated = 0;
      const seenInputEmails = new Set<string>();

      for (const input of inputs) {
        const email = normalizeEmail(input.email);
        if (seenInputEmails.has(email)) {
          throw new StoreDataError(`Duplicate email in import: ${email}`);
        }
        seenInputEmails.add(email);
        const fields = input.fields ?? {
          name: "name" in input,
          role: "role" in input,
          step: "step" in input,
        };
        const idx = indexByEmail.get(email);
        if (idx === undefined) {
          const person: Person = {
            id: nanoid(10),
            projectId,
            email,
            name: normalizeOptionalText(input.name),
            role: normalizeOptionalText(input.role),
            step: normalizeInputStep(projectId, input.step),
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
        const nextName = fields.name
          ? normalizeOptionalText(input.name)
          : current.name;
        const nextRole = fields.role
          ? normalizeOptionalText(input.role)
          : current.role;
        const nextStep =
          fields.step && input.step !== undefined
            ? normalizeInputStep(projectId, input.step, current.step)
            : current.step;
        if (
          nextName === current.name &&
          nextRole === current.role &&
          nextStep === current.step
        ) {
          continue;
        }
        const updatedPerson: Person = {
          ...current,
          name: nextName,
          role: nextRole,
          step: nextStep,
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
