import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let file: string;

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
    peopleImport: await import("./import/route"),
    sentContractsEmail: await import("./sent-contracts-email/route"),
  };
}

async function body(response: Response) {
  return response.json() as Promise<unknown>;
}

beforeEach(async () => {
  const fileName = `routes-${randomUUID()}.json`;
  file = join(process.cwd(), "test-results", fileName);
  process.env.WORKFLOW_TRACKER_STORE = "file";
  process.env.WORKFLOW_TRACKER_STORE_FILE = fileName;
});

afterEach(async () => {
  delete process.env.WORKFLOW_TRACKER_STORE;
  delete process.env.WORKFLOW_TRACKER_STORE_FILE;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  await rm(file, { force: true });
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
        role: " Reviewer ",
        step: "background_check",
      }),
    );

    expect(created.status).toBe(201);
    await expect(body(created)).resolves.toMatchObject({
      email: "person@example.com",
      name: "Person",
      role: "Reviewer",
      step: "background_check",
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

  it("returns 503 when persisted data is invalid", async () => {
    await mkdir(join(process.cwd(), "test-results"), { recursive: true });
    await writeFile(file, "{not json", "utf8");
    const { people } = await loadRoutes();

    const response = await people.GET();

    expect(response.status).toBe(503);
    await expect(body(response)).resolves.toEqual({
      error: "Stored workflow data is invalid and must be repaired.",
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
        role: "Lead",
        step: "sent_contracts",
      }),
      { params: Promise.resolve({ id: createdBody.id }) },
    );
    expect(patched.status).toBe(200);
    const patchedBody = (await body(patched)) as Record<string, unknown>;
    expect(patchedBody).toMatchObject({
      id: createdBody.id,
      email: "updated@example.com",
      role: "Lead",
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

  it("can recreate a deleted email and move the new person", async () => {
    const { people, person } = await loadRoutes();
    const created = await people.POST(
      jsonRequest("/api/people", { email: "recreate@example.com" }),
    );
    const createdBody = (await created.json()) as { id: string };

    const deleted = await person.DELETE(
      new Request(`http://localhost/api/people/${createdBody.id}`),
      { params: Promise.resolve({ id: createdBody.id }) },
    );
    expect(deleted.status).toBe(200);

    const recreated = await people.POST(
      jsonRequest("/api/people", { email: "recreate@example.com" }),
    );
    expect(recreated.status).toBe(201);
    const recreatedBody = (await recreated.json()) as { id: string };
    expect(recreatedBody.id).not.toBe(createdBody.id);

    const moved = await person.PATCH(
      jsonRequest(`/api/people/${recreatedBody.id}`, {
        step: "sent_contracts",
      }),
      { params: Promise.resolve({ id: recreatedBody.id }) },
    );
    expect(moved.status).toBe(200);

    const listed = await people.GET();
    await expect(body(listed)).resolves.toMatchObject([
      {
        id: recreatedBody.id,
        email: "recreate@example.com",
        step: "sent_contracts",
      },
    ]);
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
      jsonRequest("/api/people/missing", { step: "background_check" }),
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
        step: "background_check",
      }),
    );
    expect(moved.status).toBe(200);
    await expect(body(moved)).resolves.toMatchObject({
      updated: [
        { id: oneBody.id, step: "background_check" },
        { id: twoBody.id, step: "background_check" },
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

describe("/api/people/import", () => {
  it("creates new people and updates existing emails with roles", async () => {
    const { people, peopleImport } = await loadRoutes();
    await people.POST(
      jsonRequest("/api/people", {
        email: "existing@example.com",
        name: "Existing",
        role: "Old Role",
      }),
    );

    const imported = await peopleImport.POST(
      jsonRequest("/api/people/import", {
        people: [
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
            step: "Interview",
          },
        ],
      }),
    );

    expect(imported.status).toBe(200);
    await expect(body(imported)).resolves.toMatchObject({
      created: 1,
      updated: 1,
      people: [
        {
          email: "existing@example.com",
          name: "Existing Updated",
          role: "Lead",
          step: "sent_contracts",
        },
        {
          email: "new@example.com",
          name: "New Person",
          role: "Reviewer",
          step: "interview",
        },
      ],
    });
  });

  it("preserves omitted import fields and clears explicit blank fields", async () => {
    const { people, peopleImport } = await loadRoutes();
    await people.POST(
      jsonRequest("/api/people", {
        email: "existing@example.com",
        name: "Existing",
        role: "Old Role",
        step: "eval",
      }),
    );

    const stepOnly = await peopleImport.POST(
      jsonRequest("/api/people/import", {
        people: [{ email: "existing@example.com", step: "interview" }],
      }),
    );
    expect(stepOnly.status).toBe(200);
    await expect(body(stepOnly)).resolves.toMatchObject({
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

    const clearOptional = await peopleImport.POST(
      jsonRequest("/api/people/import", {
        people: [{ email: "existing@example.com", name: "", role: "" }],
      }),
    );
    expect(clearOptional.status).toBe(200);
    const clearBody = (await body(clearOptional)) as {
      created: number;
      updated: number;
      people: Array<Record<string, unknown>>;
    };
    expect(clearBody).toMatchObject({
      created: 0,
      updated: 1,
      people: [{ email: "existing@example.com", step: "interview" }],
    });
    expect(clearBody.people[0]).not.toHaveProperty("name");
    expect(clearBody.people[0]).not.toHaveProperty("role");
  });

  it("returns 400 for invalid import requests", async () => {
    const { peopleImport } = await loadRoutes();

    const invalidJson = await peopleImport.POST(
      new Request("http://localhost/api/people/import", {
        method: "POST",
        body: "{",
      }),
    );
    expect(invalidJson.status).toBe(400);

    const invalidPayload = await peopleImport.POST(
      jsonRequest("/api/people/import", { people: [] }),
    );
    expect(invalidPayload.status).toBe(400);
    await expect(body(invalidPayload)).resolves.toEqual({
      error: "Upload at least one person",
    });

    const duplicate = await peopleImport.POST(
      jsonRequest("/api/people/import", {
        people: [
          { email: "dupe@example.com" },
          { email: "DUPE@example.com" },
        ],
      }),
    );
    expect(duplicate.status).toBe(400);
    await expect(body(duplicate)).resolves.toEqual({
      error: "Duplicate email in import: dupe@example.com",
    });
  });
});

describe("/api/people/sent-contracts-email", () => {
  it("emails only people in Sent Contracts with personalized greetings", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "Alexia <alexia@example.com>";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { people, sentContractsEmail } = await loadRoutes();
    await people.POST(
      jsonRequest("/api/people", {
        email: "named@example.com",
        name: "Ada Lovelace",
        step: "sent_contracts",
      }),
    );
    await people.POST(
      jsonRequest("/api/people", {
        email: "fallback@example.com",
        step: "sent_contracts",
      }),
    );
    await people.POST(
      jsonRequest("/api/people", {
        email: "other@example.com",
        name: "Other Person",
        step: "eval",
      }),
    );

    const response = await sentContractsEmail.POST();

    expect(response.status).toBe(200);
    await expect(body(response)).resolves.toEqual({ sent: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const payloads = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    ) as Array<{ to: string; text: string; subject: string; from: string }>;
    expect(payloads).toMatchObject([
      {
        from: "Alexia <alexia@example.com>",
        to: "named@example.com",
        subject: "Subject Matter Expert engagement terms",
      },
      {
        from: "Alexia <alexia@example.com>",
        to: "fallback@example.com",
        subject: "Subject Matter Expert engagement terms",
      },
    ]);
    expect(payloads[0].text).toContain("Dear Ada,\n");
    expect(payloads[1].text).toContain("Hi There,\n");
    expect(payloads[0].text).toContain("Compensation: Your hourly rate will be $90/hour.");
  });

  it("returns zero for an empty Sent Contracts queue without email config", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { sentContractsEmail } = await loadRoutes();

    const response = await sentContractsEmail.POST();

    expect(response.status).toBe(200);
    await expect(body(response)).resolves.toEqual({ sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when email config is missing for a non-empty queue", async () => {
    const { people, sentContractsEmail } = await loadRoutes();
    await people.POST(
      jsonRequest("/api/people", {
        email: "missing-config@example.com",
        step: "sent_contracts",
      }),
    );

    const response = await sentContractsEmail.POST();

    expect(response.status).toBe(503);
    await expect(body(response)).resolves.toEqual({
      error: "Email sending is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    });
  });

  it("returns 502 when the email provider rejects a send", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "Alexia <alexia@example.com>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Rejected", { status: 500 }),
    );
    const { people, sentContractsEmail } = await loadRoutes();
    await people.POST(
      jsonRequest("/api/people", {
        email: "provider-error@example.com",
        step: "sent_contracts",
      }),
    );

    const response = await sentContractsEmail.POST();

    expect(response.status).toBe(502);
    await expect(body(response)).resolves.toEqual({
      error: "Failed to send Sent Contracts emails. Please retry.",
    });
  });
});
