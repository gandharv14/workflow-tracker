import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  bulkRequest,
  createPerson,
  deletePersonRequest,
  fetchPeople,
  importPeopleRequest,
  patchPerson,
} from "./api";
import { TRANSCRIPT_CONSENSUS_PROJECT_ID } from "./projects";
import { person } from "@/test/factories";

const fetchMock = vi.fn();
const projectId = TRANSCRIPT_CONSENSUS_PROJECT_ID;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("client API helpers", () => {
  it("fetches people without caching", async () => {
    const people = [person()];
    fetchMock.mockResolvedValueOnce(Response.json(people));

    await expect(fetchPeople(projectId)).resolves.toEqual(people);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/people?project=transcript-consensus",
      {
        cache: "no-store",
      },
    );
  });

  it("creates, patches, deletes, and bulk updates people with the expected requests", async () => {
    const created = person({ email: "new@example.com" });
    fetchMock
      .mockResolvedValueOnce(Response.json(created))
      .mockResolvedValueOnce(Response.json({ ...created, name: "New Name" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ deleted: 2 }))
      .mockResolvedValueOnce(
        Response.json({ created: 1, updated: 0, people: [created] }),
      );

    await expect(
      createPerson(projectId, {
        email: "new@example.com",
        name: "New",
        role: "Reviewer",
        step: "eval",
      }),
    ).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/people?project=transcript-consensus",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: "New",
          role: "Reviewer",
          step: "eval",
        }),
      },
    );

    await expect(
      patchPerson(projectId, "person/1", {
        email: "new@example.com",
        name: null,
        role: "Lead",
      }),
    ).resolves.toMatchObject({ name: "New Name" });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/people/person%2F1?project=transcript-consensus",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: null,
          role: "Lead",
        }),
      },
    );

    await expect(
      deletePersonRequest(projectId, "person/1"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/people/person%2F1?project=transcript-consensus",
      {
        method: "DELETE",
      },
    );

    await expect(
      bulkRequest(projectId, { action: "delete", ids: ["one", "two"] }),
    ).resolves.toEqual({ deleted: 2 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/people/bulk?project=transcript-consensus",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: ["one", "two"] }),
      },
    );

    await expect(
      importPeopleRequest(projectId, {
        people: [{ email: "import@example.com", role: "Ops", step: "eval" }],
      }),
    ).resolves.toEqual({ created: 1, updated: 0, people: [created] });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/people/import?project=transcript-consensus",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          people: [{ email: "import@example.com", role: "Ops", step: "eval" }],
        }),
      },
    );
  });

  it("throws server error messages when available", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "A person with that email already exists" }, {
        status: 409,
      }),
    );

    await expect(
      createPerson(projectId, { email: "dupe@example.com" }),
    ).rejects.toMatchObject({
      message: "A person with that email already exists",
      status: 409,
    } satisfies Partial<ApiError>);
  });

  it("treats deleting an already-missing person as success", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Person not found" }, { status: 404 }),
    );

    await expect(deletePersonRequest(projectId, "missing")).resolves.toBeUndefined();
  });

  it("falls back to the response status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));

    await expect(fetchPeople(projectId)).rejects.toThrow("Request failed (500)");
  });
});
