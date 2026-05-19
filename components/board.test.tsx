import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { Board } from "./board";
import * as api from "@/lib/api";
import {
  CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
  TRANSCRIPT_CONSENSUS_PROJECT_ID,
} from "@/lib/projects";
import { person } from "@/test/factories";

vi.mock("@/lib/api", () => ({
  bulkRequest: vi.fn(),
  createPerson: vi.fn(),
  deletePersonRequest: vi.fn(),
  fetchPeople: vi.fn(),
  importPeopleRequest: vi.fn(),
  patchPerson: vi.fn(),
  sendSentContractsEmailRequest: vi.fn(),
}));

const createPerson = vi.mocked(api.createPerson);
const fetchPeople = vi.mocked(api.fetchPeople);
const patchPerson = vi.mocked(api.patchPerson);
const deletePersonRequest = vi.mocked(api.deletePersonRequest);
const bulkRequest = vi.mocked(api.bulkRequest);
const importPeopleRequest = vi.mocked(api.importPeopleRequest);
const sendSentContractsEmailRequest = vi.mocked(api.sendSentContractsEmailRequest);
const toastMock = vi.mocked(toast);

function renderBoard(initialPeople: Parameters<typeof Board>[0]["initialPeople"]) {
  return render(
    <Board
      projectId={CC_AGENTIC_CODING_TAIGA_PROJECT_ID}
      initialPeople={initialPeople}
    />,
  );
}

beforeEach(() => {
  createPerson.mockReset();
  fetchPeople.mockReset();
  importPeopleRequest.mockReset();
  patchPerson.mockReset();
  deletePersonRequest.mockReset();
  bulkRequest.mockReset();
  sendSentContractsEmailRequest.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

describe("Board", () => {
  it("groups, sorts, searches, and clears results", async () => {
    const user = userEvent.setup();
    const older = person({
      id: "older",
      email: "older@example.com",
      name: "Older",
      step: "eval",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = person({
      id: "newer",
      email: "newer@example.com",
      name: "Newer",
      step: "eval",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    const ada = person({
      id: "ada",
      email: "ada@example.com",
      name: "Ada Lovelace",
      step: "background_check",
    });

    const { container } = renderBoard([older, ada, newer]);

    expect(screen.getByText("3 people across 5 stages")).toBeInTheDocument();
    expect(container.textContent?.indexOf("newer@example.com")).toBeLessThan(
      container.textContent?.indexOf("older@example.com") ?? Infinity,
    );

    await user.type(screen.getByLabelText("Search people"), "ada");
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByText("older@example.com")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Clear search"));
    expect(screen.getByText("older@example.com")).toBeInTheDocument();
  });

  it("renders Transcript Consensus with only its workflow steps", async () => {
    const user = userEvent.setup();
    const transcriptPerson = person({
      id: "transcript",
      projectId: TRANSCRIPT_CONSENSUS_PROJECT_ID,
      email: "transcript@example.com",
      step: "background_check",
    });
    const created = person({
      id: "created-transcript",
      projectId: TRANSCRIPT_CONSENSUS_PROJECT_ID,
      email: "created-transcript@example.com",
      step: "in_production",
    });
    createPerson.mockResolvedValueOnce(created);

    render(
      <Board
        projectId={TRANSCRIPT_CONSENSUS_PROJECT_ID}
        initialPeople={[transcriptPerson]}
      />,
    );

    expect(screen.getAllByText("Transcript Consensus").length).toBeGreaterThan(0);
    expect(screen.getByText("1 person across 3 stages")).toBeInTheDocument();
    expect(screen.getByText("Eval")).toBeInTheDocument();
    expect(screen.getByText("Background Check + Gmail Creation")).toBeInTheDocument();
    expect(screen.getByText("In Production")).toBeInTheDocument();
    expect(screen.queryByText("Interview")).not.toBeInTheDocument();
    expect(screen.queryByText("Sent Contracts")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Email Sent Contracts" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add person/ }));
    const stepSelect = screen.getByLabelText("Workflow step");
    expect(
      within(stepSelect).queryByRole("option", { name: "Interview" }),
    ).not.toBeInTheDocument();
    expect(
      within(stepSelect).queryByRole("option", { name: "Sent Contracts" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "created-transcript@example.com");
    await user.selectOptions(stepSelect, "in_production");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() =>
      expect(createPerson).toHaveBeenCalledWith(TRANSCRIPT_CONSENSUS_PROJECT_ID, {
        email: "created-transcript@example.com",
        name: undefined,
        role: undefined,
        step: "in_production",
      }),
    );
  });

  it("downloads all queues as a single board CSV", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:workflow-board");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const evalPerson = person({
      id: "eval",
      email: "eval@example.com",
      name: "Eval Person",
      role: "Reviewer",
      step: "eval",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const productionPerson = person({
      id: "production",
      email: "production@example.com",
      name: "Production Person",
      role: "Lead",
      step: "in_production",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    renderBoard([productionPerson, evalPerson]);

    await user.type(screen.getByLabelText("Search people"), "eval");
    await user.click(screen.getByRole("button", { name: "Download all CSV" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await expect(createObjectURL.mock.calls[0][0].text()).resolves.toBe(
      "email,name,role,step\n" +
        "eval@example.com,Eval Person,Reviewer,eval\n" +
        "production@example.com,Production Person,Lead,in_production\n",
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:workflow-board");
    expect(toastMock.success).toHaveBeenCalledWith("Downloaded board CSV");
  });

  it("sends emails from the Sent Contracts column action", async () => {
    const user = userEvent.setup();
    const sent = person({
      id: "sent",
      email: "sent@example.com",
      step: "sent_contracts",
    });
    const evalPerson = person({
      id: "eval",
      email: "eval@example.com",
      step: "eval",
    });
    sendSentContractsEmailRequest.mockResolvedValueOnce({ sent: 1 });

    renderBoard([sent, evalPerson]);

    await user.click(screen.getByRole("button", { name: "Email Sent Contracts" }));

    await waitFor(() => expect(sendSentContractsEmailRequest).toHaveBeenCalledTimes(1));
    expect(sendSentContractsEmailRequest).toHaveBeenCalledWith(
      CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "Sent 1 Sent Contracts email",
    );
  });

  it("adds people and surfaces create errors without closing the dialog", async () => {
    const user = userEvent.setup();
    const created = person({
      id: "created",
      email: "created@example.com",
      name: "Created Person",
      step: "background_check",
    });
    createPerson.mockResolvedValueOnce(created);

    renderBoard([]);

    expect(screen.getByText("No one in the pipeline yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Add person/ })[0]);
    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.type(screen.getByLabelText(/Name/), "Created Person");
    await user.selectOptions(screen.getByLabelText("Workflow step"), "background_check");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() => {
      expect(createPerson).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        {
          email: "created@example.com",
          name: "Created Person",
          role: undefined,
          step: "background_check",
        },
      );
    });
    expect(await screen.findByText("created@example.com")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Added created@example.com");

    createPerson.mockRejectedValueOnce(new Error("Duplicate email"));
    await user.click(screen.getByRole("button", { name: /Add person/ }));
    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.click(screen.getByRole("button", { name: "Add person" }));
    expect(await screen.findByText("Duplicate email")).toBeInTheDocument();
  });

  it("reveals a newly added person when the current search would hide them", async () => {
    const user = userEvent.setup();
    const existing = person({
      id: "existing",
      email: "existing@example.com",
      name: "Existing Person",
    });
    const created = person({
      id: "created",
      email: "created@example.com",
      name: "Created Person",
    });
    createPerson.mockResolvedValueOnce(created);

    renderBoard([existing]);

    const search = screen.getByLabelText("Search people");
    await user.type(search, "existing");
    expect(screen.queryByText("created@example.com")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add person/ }));
    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.type(screen.getByLabelText(/Name/), "Created Person");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    expect(await screen.findByText("created@example.com")).toBeInTheDocument();
    expect(search).toHaveValue("");
  });

  it("replaces stale same-email cards when a deleted person is recreated", async () => {
    const user = userEvent.setup();
    const stale = person({
      id: "old-id",
      email: "recreated@example.com",
      name: "Old Record",
      step: "eval",
    });
    const recreated = person({
      id: "new-id",
      email: "recreated@example.com",
      name: "Recreated Record",
      step: "eval",
    });
    createPerson.mockResolvedValueOnce(recreated);
    patchPerson.mockResolvedValueOnce({
      ...recreated,
      step: "sent_contracts",
    });

    renderBoard([stale]);

    await user.click(screen.getByRole("button", { name: /Add person/ }));
    await user.type(screen.getByLabelText("Email"), "recreated@example.com");
    await user.type(screen.getByLabelText(/Name/), "Recreated Record");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() =>
      expect(createPerson).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        {
          email: "recreated@example.com",
          name: "Recreated Record",
          role: undefined,
          step: "eval",
        },
      ),
    );
    expect(screen.getAllByLabelText("Open menu for recreated@example.com")).toHaveLength(
      1,
    );
    expect(screen.queryByText("Old Record")).not.toBeInTheDocument();
    expect(screen.getByText("Recreated Record")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Open menu for recreated@example.com"));
    await user.click(screen.getByRole("button", { name: "Sent Contracts" }));

    await waitFor(() =>
      expect(patchPerson).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "new-id",
        {
          step: "sent_contracts",
        },
      ),
    );
    expect(patchPerson).not.toHaveBeenCalledWith(
      CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
      "old-id",
      {
        step: "sent_contracts",
      },
    );
  });

  it("retries a stale move against the recreated same-email person", async () => {
    const user = userEvent.setup();
    const stale = person({
      id: "old-id",
      email: "test@gmail.com",
      name: "Old Record",
      step: "eval",
    });
    const recreated = person({
      id: "new-id",
      email: "test@gmail.com",
      name: "Recreated Record",
      step: "eval",
    });
    fetchPeople.mockResolvedValueOnce([recreated]);
    patchPerson
      .mockRejectedValueOnce(
        Object.assign(new Error("Person not found"), { status: 404 }),
      )
      .mockResolvedValueOnce({
        ...recreated,
        step: "sent_contracts",
      });

    renderBoard([stale]);

    await user.click(screen.getByLabelText("Open menu for test@gmail.com"));
    await user.click(screen.getByRole("button", { name: "Sent Contracts" }));

    await waitFor(() => {
      expect(fetchPeople).toHaveBeenCalled();
      expect(patchPerson).toHaveBeenNthCalledWith(
        2,
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "new-id",
        {
          step: "sent_contracts",
        },
      );
    });
    expect(screen.queryByText("Old Record")).not.toBeInTheDocument();
    expect(screen.getByText("Recreated Record")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Moved to Sent Contracts");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("edits, moves by menu, and deletes a person optimistically", async () => {
    const user = userEvent.setup();
    const existing = person({
      id: "p1",
      email: "person@example.com",
      name: "Person",
      step: "eval",
    });
    patchPerson
      .mockResolvedValueOnce({
        ...existing,
        email: "edited@example.com",
        name: "Edited",
      })
      .mockResolvedValueOnce({
        ...existing,
        email: "edited@example.com",
        name: "Edited",
        step: "background_check",
      });
    deletePersonRequest.mockResolvedValueOnce(undefined);

    renderBoard([existing]);

    await user.click(screen.getByLabelText("Open menu for person@example.com"));
    await user.click(await screen.findByText("Edit"));
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "edited@example.com");
    await user.clear(screen.getByLabelText(/Name/));
    await user.type(screen.getByLabelText(/Name/), "Edited");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("edited@example.com")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Updated");

    await user.click(screen.getByLabelText("Open menu for edited@example.com"));
    await user.click(
      screen.getByRole("button", { name: "Background Check + Gmail Creation" }),
    );
    await waitFor(() =>
      expect(patchPerson).toHaveBeenLastCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "p1",
        {
          step: "background_check",
        },
      ),
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "Moved to Background Check + Gmail Creation",
    );

    await user.click(screen.getByLabelText("Open menu for edited@example.com"));
    await user.click(await screen.findByText("Delete"));
    await waitFor(() =>
      expect(deletePersonRequest).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "p1",
      ),
    );
    expect(screen.queryByText("edited@example.com")).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Removed edited@example.com");
  });

  it("bulk moves, clears selection, deletes, and rolls back on failed bulk delete", async () => {
    const user = userEvent.setup();
    const one = person({ id: "one", email: "one@example.com", step: "eval" });
    const two = person({ id: "two", email: "two@example.com", step: "eval" });
    bulkRequest
      .mockResolvedValueOnce({ updated: [{ ...one, step: "background_check" }] })
      .mockRejectedValueOnce(new Error("Bulk delete failed"));

    renderBoard([one, two]);

    await user.click(screen.getByLabelText("Select one@example.com"));
    await user.click(screen.getByLabelText("Select two@example.com"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Move to/ }));
    await user.click(
      screen.getByRole("button", { name: "Background Check + Gmail Creation" }),
    );
    await waitFor(() =>
      expect(bulkRequest).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        {
          action: "move",
          ids: ["one", "two"],
          step: "background_check",
        },
      ),
    );
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.queryByText("two@example.com")).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith(
      "Moved 1 of 2 to Background Check + Gmail Creation",
    );

    await user.click(screen.getByLabelText("Select one@example.com"));
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Bulk delete failed"),
    );
    expect(screen.getByText("one@example.com")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Clear selection"));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("uploads a CSV and replaces matching emails with imported users", async () => {
    const user = userEvent.setup();
    const existing = person({
      id: "existing",
      email: "existing@example.com",
      name: "Existing",
      role: "Old Role",
      step: "eval",
    });
    const updated = {
      ...existing,
      name: "Existing Updated",
      role: "Lead",
      step: "sent_contracts" as const,
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const imported = person({
      id: "imported",
      email: "new@example.com",
      name: "New User",
      role: "Reviewer",
      step: "background_check",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    importPeopleRequest.mockResolvedValueOnce({
      created: 1,
      updated: 1,
      people: [updated, imported],
    });
    const file = new File(
      [
        "email,name,role,step\nexisting@example.com,Existing Updated,Lead,sent_contracts\nnew@example.com,New User,Reviewer,background_check\n",
      ],
      "people.csv",
      { type: "text/csv" },
    );

    renderBoard([existing]);

    await user.click(screen.getByRole("button", { name: "Upload CSV" }));
    expect(screen.getByText("email,name,role,step")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("CSV file"), {
      target: { files: [file] },
    });
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Upload CSV",
      }),
    );

    await waitFor(() =>
      expect(importPeopleRequest).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        {
          people: [
            {
              email: "existing@example.com",
              name: "Existing Updated",
              role: "Lead",
              step: "sent_contracts",
              fields: { name: true, role: true, step: true },
            },
            {
              email: "new@example.com",
              name: "New User",
              role: "Reviewer",
              step: "background_check",
              fields: { name: true, role: true, step: true },
            },
          ],
        },
      ),
    );
    expect(screen.queryByText("Old Role")).not.toBeInTheDocument();
    expect(await screen.findByText("Existing Updated")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith(
      "Imported 2 users (1 new, 1 updated)",
    );
  });

  it("rolls back failed single moves and deletes", async () => {
    const user = userEvent.setup();
    const existing = person({
      id: "p1",
      email: "rollback@example.com",
      step: "eval",
    });
    patchPerson.mockRejectedValueOnce(new Error("Move failed"));
    deletePersonRequest.mockRejectedValueOnce(new Error("Delete failed"));

    renderBoard([existing]);

    await user.click(screen.getByLabelText("Open menu for rollback@example.com"));
    await user.click(screen.getByRole("button", { name: "Sent Contracts" }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Move failed"),
    );
    expect(screen.getByText("rollback@example.com")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Open menu for rollback@example.com"));
    await user.click(await screen.findByText("Delete"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Delete failed"),
    );
    expect(screen.getByText("rollback@example.com")).toBeInTheDocument();

    const evalColumn = screen.getByText("Eval").closest("div");
    expect(evalColumn).not.toBeNull();
    if (evalColumn) {
      expect(within(evalColumn).getByText("1")).toBeInTheDocument();
    }
  });

  it("does not restore stale people when delete reports they are already missing", async () => {
    const user = userEvent.setup();
    const existing = person({
      id: "missing-id",
      email: "missing@example.com",
      step: "eval",
    });
    deletePersonRequest.mockRejectedValueOnce(
      Object.assign(new Error("Person not found"), { status: 404 }),
    );

    renderBoard([existing]);

    await user.click(screen.getByLabelText("Open menu for missing@example.com"));
    await user.click(await screen.findByText("Delete"));

    await waitFor(() =>
      expect(deletePersonRequest).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "missing-id",
      ),
    );
    expect(screen.queryByText("missing@example.com")).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Removed missing@example.com");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("removes stale cards when a move reports the person is missing", async () => {
    const user = userEvent.setup();
    const stale = person({
      id: "stale-id",
      email: "stale@example.com",
      step: "eval",
    });
    patchPerson.mockRejectedValueOnce(
      Object.assign(new Error("Person not found"), { status: 404 }),
    );

    renderBoard([stale]);

    await user.click(screen.getByLabelText("Open menu for stale@example.com"));
    await user.click(screen.getByRole("button", { name: "Sent Contracts" }));

    await waitFor(() =>
      expect(patchPerson).toHaveBeenCalledWith(
        CC_AGENTIC_CODING_TAIGA_PROJECT_ID,
        "stale-id",
        {
          step: "sent_contracts",
        },
      ),
    );
    expect(screen.queryByText("stale@example.com")).not.toBeInTheDocument();
    expect(toastMock.error).toHaveBeenCalledWith("Person no longer exists");
  });
});
