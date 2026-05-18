import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function loadRoutes() {
  vi.resetModules();
  return {
    people: await import("./route"),
    person: await import("./[id]/route"),
    bulk: await import("./bulk/route"),
  };
}

async function body(response: Response) {
  return response.json() as Promise<unknown>;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "workflow-routes-"));
  process.env.WORKFLOW_TRACKER_STORE = "file";
  process.env.WORKFLOW_TRACKER_STORE_FILE = join(dir, "people.json");
});

afterEach(async () => {
  delete process.env.WORKFLOW_TRACKER_STORE;
  delete process.env.WORKFLOW_TRACKER_STORE_FILE;
  await rm(dir, { recursive: true, force: true });
});

describe("/api/people", () => {
  it("lists and creates people", async () => {
    const { people } = await loadRoutes();

    const empty = await people.GET();
    await expect(body(empty)).resolves.toEqual([]);

    const created = await people.POST(
      jsonRequest("/api/people", {
        email: "PERSON@EXAMPLE.COM",
        name: " Person ",
        step: "interview",
      }),
    );

    expect(created.status).toBe(201);
    await expect(body(created)).resolves.toMatchObject({
      email: "person@example.com",
      name: "Person",
      step: "interview",
    });

    const listed = await people.GET();
    await expect(body(listed)).resolves.toHaveLength(1);
  });

  it("returns 400 for invalid JSON or invalid payloads and 409 for duplicates", async () => {
    const { people } = await loadRoutes();

    const invalidJson = await people.POST(
      new Request("http://localhost/api/people", {
        method: "POST",
        body: "{",
      }),
    );
    expect(invalidJson.status).toBe(400);
    await expect(body(invalidJson)).resolves.toEqual({
      error: "Invalid JSON body",
    });

    const invalidPayload = await people.POST(
      jsonRequest("/api/people", { email: "bad" }),
    );
    expect(invalidPayload.status).toBe(400);
    await expect(body(invalidPayload)).resolves.toEqual({
      error: "Must be a valid email address",
    });

    await people.POST(jsonRequest("/api/people", { email: "dupe@example.com" }));
    const duplicate = await people.POST(
      jsonRequest("/api/people", { email: "DUPE@example.com" }),
    );
    expect(duplicate.status).toBe(409);
    await expect(body(duplicate)).resolves.toEqual({
      error: "A person with that email already exists",
    });
  });
});

describe("/api/people/[id]", () => {
  it("patches and deletes a person", async () => {
    const { people, person } = await loadRoutes();
    const created = await people.POST(
      jsonRequest("/api/people", { email: "edit@example.com", name: "Edit" }),
    );
    const createdBody = (await created.json()) as { id: string };

    const patched = await person.PATCH(
      jsonRequest(`/api/people/${createdBody.id}`, {
        email: "updated@example.com",
        name: null,
        step: "sent_contracts",
      }),
      { params: Promise.resolve({ id: createdBody.id }) },
    );
    expect(patched.status).toBe(200);
    const patchedBody = (await body(patched)) as Record<string, unknown>;
    expect(patchedBody).toMatchObject({
      id: createdBody.id,
      email: "updated@example.com",
      step: "sent_contracts",
    });
    expect(patchedBody).not.toHaveProperty("name");

    const deleted = await person.DELETE(
      new Request(`http://localhost/api/people/${createdBody.id}`),
      { params: Promise.resolve({ id: createdBody.id }) },
    );
    expect(deleted.status).toBe(200);
    await expect(body(deleted)).resolves.toEqual({ ok: true });
  });

  it("returns 400, 404, and 409 errors", async () => {
    const { people, person } = await loadRoutes();
    const one = await people.POST(
      jsonRequest("/api/people", { email: "one@example.com" }),
    );
    const two = await people.POST(
      jsonRequest("/api/people", { email: "two@example.com" }),
    );
    const oneBody = (await one.json()) as { id: string };
    await two.json();

    const invalidJson = await person.PATCH(
      new Request(`http://localhost/api/people/${oneBody.id}`, {
        method: "PATCH",
        body: "{",
      }),
      { params: Promise.resolve({ id: oneBody.id }) },
    );
    expect(invalidJson.status).toBe(400);

    const notFound = await person.PATCH(
      jsonRequest("/api/people/missing", { step: "interview" }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(notFound.status).toBe(404);

    const duplicate = await person.PATCH(
      jsonRequest(`/api/people/${oneBody.id}`, { email: "two@example.com" }),
      { params: Promise.resolve({ id: oneBody.id }) },
    );
    expect(duplicate.status).toBe(409);

    const missingDelete = await person.DELETE(
      new Request("http://localhost/api/people/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(missingDelete.status).toBe(404);
  });
});

describe("/api/people/bulk", () => {
  it("moves and deletes matching people", async () => {
    const { people, bulk } = await loadRoutes();
    const one = await people.POST(
      jsonRequest("/api/people", { email: "one@example.com" }),
    );
    const two = await people.POST(
      jsonRequest("/api/people", { email: "two@example.com" }),
    );
    const oneBody = (await one.json()) as { id: string };
    const twoBody = (await two.json()) as { id: string };

    const moved = await bulk.POST(
      jsonRequest("/api/people/bulk", {
        action: "move",
        ids: [oneBody.id, twoBody.id],
        step: "gmail_creation",
      }),
    );
    expect(moved.status).toBe(200);
    await expect(body(moved)).resolves.toMatchObject({
      updated: [
        { id: oneBody.id, step: "gmail_creation" },
        { id: twoBody.id, step: "gmail_creation" },
      ],
    });

    const deleted = await bulk.POST(
      jsonRequest("/api/people/bulk", {
        action: "delete",
        ids: [oneBody.id],
      }),
    );
    expect(deleted.status).toBe(200);
    await expect(body(deleted)).resolves.toEqual({ deleted: 1 });
  });

  it("returns 400 for invalid bulk requests", async () => {
    const { bulk } = await loadRoutes();

    const invalidJson = await bulk.POST(
      new Request("http://localhost/api/people/bulk", {
        method: "POST",
        body: "{",
      }),
    );
    expect(invalidJson.status).toBe(400);

    const missingStep = await bulk.POST(
      jsonRequest("/api/people/bulk", { action: "move", ids: ["one"] }),
    );
    expect(missingStep.status).toBe(400);
    await expect(body(missingStep)).resolves.toEqual({
      error: "step is required when action is 'move'",
    });
  });
});
