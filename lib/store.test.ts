import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Step } from "./steps";

let file: string;

async function loadStore() {
  vi.resetModules();
  return import("./store");
}

beforeEach(async () => {
  const fileName = `store-${randomUUID()}.json`;
  file = join(process.cwd(), "test-results", fileName);
  await mkdir(join(process.cwd(), "test-results"), { recursive: true });
  process.env.WORKFLOW_TRACKER_STORE = "file";
  process.env.WORKFLOW_TRACKER_STORE_FILE = fileName;
});

afterEach(async () => {
  delete process.env.WORKFLOW_TRACKER_STORE;
  delete process.env.WORKFLOW_TRACKER_STORE_FILE;
  vi.unstubAllGlobals();
  vi.doUnmock("@vercel/blob");
  await rm(file, { force: true });
});

describe("file-backed store", () => {
  it("starts empty and rejects corrupt persisted JSON", async () => {
    const { listPeople } = await loadStore();

    await expect(listPeople()).resolves.toEqual([]);

    await writeFile(file, "{not json", "utf8");
    await expect(listPeople()).rejects.toThrow(
      "Stored workflow data is not valid JSON",
    );
  });

  it("normalizes valid legacy persisted people", async () => {
    await writeFile(
      file,
      JSON.stringify([
        {
          id: "one",
          email: " ONE@example.com ",
          name: " One ",
          role: " Reviewer ",
          step: "Eval + Interview",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "two",
          email: "two@example.com",
          step: "gmail_creation",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      "utf8",
    );
    const { listPeople } = await loadStore();

    await expect(listPeople()).resolves.toMatchObject([
      {
        id: "one",
        email: "one@example.com",
        name: "One",
        role: "Reviewer",
        step: "eval",
      },
      { id: "two", step: "background_check" },
    ]);
  });

  it("rejects invalid or duplicate persisted people", async () => {
    const { listPeople } = await loadStore();

    await writeFile(
      file,
      JSON.stringify([
        {
          id: "one",
          email: "one@example.com",
          step: "eval",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "two",
          email: " ONE@example.com ",
          step: "eval",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      "utf8",
    );

    await expect(listPeople()).rejects.toThrow(
      "Stored workflow data has duplicate email one@example.com",
    );
  });

  it("adds people with normalized email, trimmed name, timestamps, and a default step", async () => {
    const { addPerson, listPeople } = await loadStore();

    const result = await addPerson({
      email: "  PERSON@EXAMPLE.COM ",
      name: " Person One ",
      role: " Reviewer ",
    });

    expect(result).toMatchObject({
      ok: true,
      person: {
        email: "person@example.com",
        name: "Person One",
        role: "Reviewer",
        step: "eval",
      },
    });
    if (result.ok) {
      expect(result.person.id).toHaveLength(10);
      expect(Date.parse(result.person.createdAt)).not.toBeNaN();
      expect(result.person.updatedAt).toBe(result.person.createdAt);
    }
    await expect(listPeople()).resolves.toHaveLength(1);
  });

  it("rejects duplicate emails and does not write on duplicate", async () => {
    const { addPerson } = await loadStore();

    await addPerson({ email: "dupe@example.com" });
    const before = await readFile(file, "utf8");
    const result = await addPerson({ email: " DUPE@example.com " });

    expect(result).toEqual({ ok: false, reason: "duplicate_email" });
    await expect(readFile(file, "utf8")).resolves.toBe(before);
  });

  it("updates fields, clears names and roles, and rejects missing or conflicting updates", async () => {
    const { addPerson, updatePerson } = await loadStore();
    const first = await addPerson({
      email: "one@example.com",
      name: "One",
      role: "Reviewer",
    });
    const second = await addPerson({ email: "two@example.com" });
    if (!first.ok || !second.ok) throw new Error("fixtures failed");

    await expect(
      updatePerson(first.person.id, {
        email: " renamed@example.com ",
        name: null,
        role: null,
        step: "background_check",
      }),
    ).resolves.toMatchObject({
      ok: true,
      person: {
        email: "renamed@example.com",
        name: undefined,
        role: undefined,
        step: "background_check",
      },
    });

    await expect(updatePerson("missing", { step: "eval" })).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(
      updatePerson(first.person.id, { email: second.person.email }),
    ).resolves.toEqual({ ok: false, reason: "duplicate_email" });
  });

  it("deletes existing people and reports missing deletes", async () => {
    const { addPerson, deletePerson, listPeople } = await loadStore();
    const created = await addPerson({ email: "delete@example.com" });
    if (!created.ok) throw new Error("fixture failed");

    await expect(deletePerson(created.person.id)).resolves.toEqual({ ok: true });
    await expect(deletePerson(created.person.id)).resolves.toEqual({
      ok: false,
    });
    await expect(listPeople()).resolves.toEqual([]);
  });

  it("bulk moves and deletes matching people", async () => {
    const { addPerson, bulkDelete, bulkMove, listPeople } = await loadStore();
    const one = await addPerson({ email: "one@example.com", step: "eval" });
    const two = await addPerson({ email: "two@example.com", step: "eval" });
    const three = await addPerson({
      email: "three@example.com",
      step: "sent_contracts",
    });
    if (!one.ok || !two.ok || !three.ok) throw new Error("fixtures failed");

    await expect(
      bulkMove([one.person.id, two.person.id], "background_check"),
    ).resolves.toMatchObject({
      updated: [
        { id: one.person.id, step: "background_check" },
        { id: two.person.id, step: "background_check" },
      ],
    });

    await expect(
      bulkDelete([one.person.id, "missing"]),
    ).resolves.toEqual({ deleted: 1 });
    await expect(listPeople()).resolves.toHaveLength(2);
  });

  it("imports people by creating new emails and updating existing emails", async () => {
    const { addPerson, importPeople, listPeople } = await loadStore();
    const existing = await addPerson({
      email: "existing@example.com",
      name: "Existing",
      role: "Old Role",
      step: "eval",
    });
    if (!existing.ok) throw new Error("fixture failed");

    await expect(
      importPeople([
        {
          email: "EXISTING@example.com",
          name: "Existing Updated",
          role: "Lead",
          step: "sent_contracts",
        },
        {
          email: "new@example.com",
          name: "New Person",
          role: "Reviewer",
          step: "background_check",
        },
      ]),
    ).resolves.toMatchObject({
      created: 1,
      updated: 1,
      people: [
        {
          id: existing.person.id,
          email: "existing@example.com",
          name: "Existing Updated",
          role: "Lead",
          step: "sent_contracts",
        },
        {
          email: "new@example.com",
          name: "New Person",
          role: "Reviewer",
          step: "background_check",
        },
      ],
    });

    await expect(listPeople()).resolves.toMatchObject([
      {
        id: existing.person.id,
        email: "existing@example.com",
        name: "Existing Updated",
        role: "Lead",
        step: "sent_contracts",
      },
      {
        email: "new@example.com",
        name: "New Person",
        role: "Reviewer",
        step: "background_check",
      },
    ]);
  });

  it("imports existing people as partial updates and clears explicit blanks", async () => {
    const { addPerson, importPeople, listPeople } = await loadStore();
    const existing = await addPerson({
      email: "existing@example.com",
      name: "Existing",
      role: "Old Role",
      step: "eval",
    });
    if (!existing.ok) throw new Error("fixture failed");

    await expect(
      importPeople([
        {
          email: "existing@example.com",
          step: "interview",
          fields: { step: true },
        },
      ]),
    ).resolves.toMatchObject({
      created: 0,
      updated: 1,
      people: [
        {
          email: "existing@example.com",
          name: "Existing",
          role: "Old Role",
          step: "interview",
        },
      ],
    });

    await expect(
      importPeople([
        {
          email: "existing@example.com",
          name: undefined,
          role: undefined,
          fields: { name: true, role: true },
        },
      ]),
    ).resolves.toMatchObject({
      created: 0,
      updated: 1,
      people: [
        {
          email: "existing@example.com",
          name: undefined,
          role: undefined,
          step: "interview",
        },
      ],
    });

    await expect(listPeople()).resolves.toMatchObject([
      {
        email: "existing@example.com",
        name: undefined,
        role: undefined,
        step: "interview",
      },
    ]);
  });

  it("does not rewrite or count no-op imports and rejects duplicate input emails", async () => {
    const { addPerson, importPeople } = await loadStore();
    const existing = await addPerson({
      email: "noop@example.com",
      name: "Noop",
      role: "Reviewer",
      step: "eval",
    });
    if (!existing.ok) throw new Error("fixture failed");

    const beforeNoop = await readFile(file, "utf8");
    await expect(
      importPeople([
        {
          email: "noop@example.com",
          name: "Noop",
          role: "Reviewer",
          step: "eval",
        },
      ]),
    ).resolves.toEqual({ created: 0, updated: 0, people: [] });
    await expect(readFile(file, "utf8")).resolves.toBe(beforeNoop);

    await expect(
      importPeople([
        { email: "dupe@example.com" },
        { email: " DUPE@example.com " },
      ]),
    ).rejects.toThrow("Duplicate email in import: dupe@example.com");
  });

  it("does not rewrite the file for no-op bulk mutations", async () => {
    const { addPerson, bulkDelete, bulkMove } = await loadStore();
    const created = await addPerson({
      email: "noop@example.com",
      step: "eval" satisfies Step,
    });
    if (!created.ok) throw new Error("fixture failed");

    const beforeMove = await readFile(file, "utf8");
    await bulkMove([created.person.id], "eval");
    await expect(readFile(file, "utf8")).resolves.toBe(beforeMove);

    await bulkDelete(["missing"]);
    await expect(readFile(file, "utf8")).resolves.toBe(beforeMove);
  });

  it("serializes concurrent mutations through the in-process lock", async () => {
    const { addPerson, listPeople } = await loadStore();

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        addPerson({ email: `person-${index}@example.com` }),
      ),
    );

    await expect(listPeople()).resolves.toHaveLength(8);
  });
});

describe("blob-backed store", () => {
  it("returns an empty list when the blob is missing", async () => {
    class BlobError extends Error {}
    class BlobNotFoundError extends Error {}
    class BlobPreconditionFailedError extends Error {}
    const head = vi.fn().mockRejectedValue(new BlobNotFoundError());

    vi.doMock("@vercel/blob", () => ({
      BlobError,
      BlobNotFoundError,
      BlobPreconditionFailedError,
      head,
      put: vi.fn(),
    }));
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.WORKFLOW_TRACKER_STORE;

    const { listPeople } = await loadStore();

    await expect(listPeople()).resolves.toEqual([]);
    expect(head).toHaveBeenCalledWith("people.json");
  });

  it("retries writes after blob precondition failures", async () => {
    class BlobError extends Error {}
    class BlobNotFoundError extends Error {}
    class BlobPreconditionFailedError extends Error {}
    const head = vi.fn().mockResolvedValue({
      downloadUrl: "https://blob.example/people.json",
      etag: "etag-1",
    });
    const put = vi
      .fn()
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce(undefined);

    vi.doMock("@vercel/blob", () => ({
      BlobError,
      BlobNotFoundError,
      BlobPreconditionFailedError,
      head,
      put,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("[]", { status: 200 })),
      ),
    );
    delete process.env.WORKFLOW_TRACKER_STORE;

    const { addPerson } = await loadStore();

    await expect(addPerson({ email: "retry@example.com" })).resolves.toMatchObject({
      ok: true,
      person: { email: "retry@example.com" },
    });
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("uses conditional create semantics when the blob is missing", async () => {
    class BlobError extends Error {}
    class BlobNotFoundError extends Error {}
    class BlobPreconditionFailedError extends Error {}
    const head = vi.fn().mockRejectedValue(new BlobNotFoundError());
    const put = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@vercel/blob", () => ({
      BlobError,
      BlobNotFoundError,
      BlobPreconditionFailedError,
      head,
      put,
    }));
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.WORKFLOW_TRACKER_STORE;

    const { addPerson } = await loadStore();

    await expect(addPerson({ email: "first@example.com" })).resolves.toMatchObject({
      ok: true,
      person: { email: "first@example.com" },
    });
    expect(put).toHaveBeenCalledWith(
      "people.json",
      expect.any(String),
      expect.objectContaining({ allowOverwrite: false }),
    );
  });

  it("retries when a missing blob is created by another instance first", async () => {
    class BlobError extends Error {}
    class BlobNotFoundError extends Error {}
    class BlobPreconditionFailedError extends Error {}
    const head = vi
      .fn()
      .mockRejectedValueOnce(new BlobNotFoundError())
      .mockResolvedValueOnce({
        downloadUrl: "https://blob.example/people.json",
        etag: "etag-2",
      });
    const put = vi
      .fn()
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce(undefined);

    vi.doMock("@vercel/blob", () => ({
      BlobError,
      BlobNotFoundError,
      BlobPreconditionFailedError,
      head,
      put,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "existing",
              email: "existing@example.com",
              step: "eval",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      ),
    );
    delete process.env.WORKFLOW_TRACKER_STORE;

    const { addPerson } = await loadStore();

    await expect(addPerson({ email: "new@example.com" })).resolves.toMatchObject({
      ok: true,
      person: { email: "new@example.com" },
    });
    expect(put).toHaveBeenNthCalledWith(
      1,
      "people.json",
      expect.any(String),
      expect.objectContaining({ allowOverwrite: false }),
    );
    expect(put).toHaveBeenNthCalledWith(
      2,
      "people.json",
      expect.stringContaining("existing@example.com"),
      expect.objectContaining({ allowOverwrite: true, ifMatch: "etag-2" }),
    );
  });
});
