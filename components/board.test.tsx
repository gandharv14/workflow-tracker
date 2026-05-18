import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { Board } from "./board";
import * as api from "@/lib/api";
import { person } from "@/test/factories";

vi.mock("@/lib/api", () => ({
  bulkRequest: vi.fn(),
  createPerson: vi.fn(),
  deletePersonRequest: vi.fn(),
  patchPerson: vi.fn(),
}));

const createPerson = vi.mocked(api.createPerson);
const patchPerson = vi.mocked(api.patchPerson);
const deletePersonRequest = vi.mocked(api.deletePersonRequest);
const bulkRequest = vi.mocked(api.bulkRequest);
const toastMock = vi.mocked(toast);

beforeEach(() => {
  createPerson.mockReset();
  patchPerson.mockReset();
  deletePersonRequest.mockReset();
  bulkRequest.mockReset();
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
      step: "interview",
    });

    const { container } = render(
      <Board initialPeople={[older, ada, newer]} />,
    );

    expect(screen.getByText("3 people across 6 stages")).toBeInTheDocument();
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

  it("adds people and surfaces create errors without closing the dialog", async () => {
    const user = userEvent.setup();
    const created = person({
      id: "created",
      email: "created@example.com",
      name: "Created Person",
      step: "interview",
    });
    createPerson.mockResolvedValueOnce(created);

    render(<Board initialPeople={[]} />);

    expect(screen.getByText("No one in the pipeline yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Add person/ })[0]);
    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.type(screen.getByLabelText(/Name/), "Created Person");
    await user.selectOptions(screen.getByLabelText("Workflow step"), "interview");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() => {
      expect(createPerson).toHaveBeenCalledWith({
        email: "created@example.com",
        name: "Created Person",
        step: "interview",
      });
    });
    expect(await screen.findByText("created@example.com")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Added created@example.com");

    createPerson.mockRejectedValueOnce(new Error("Duplicate email"));
    await user.click(screen.getByRole("button", { name: /Add person/ }));
    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.click(screen.getByRole("button", { name: "Add person" }));
    expect(await screen.findByText("Duplicate email")).toBeInTheDocument();
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

    render(<Board initialPeople={[existing]} />);

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
    await user.click(screen.getByRole("button", { name: "Background Check" }));
    await waitFor(() =>
      expect(patchPerson).toHaveBeenLastCalledWith("p1", {
        step: "background_check",
      }),
    );
    expect(toastMock.success).toHaveBeenCalledWith("Moved to Background Check");

    await user.click(screen.getByLabelText("Open menu for edited@example.com"));
    await user.click(await screen.findByText("Delete"));
    await waitFor(() => expect(deletePersonRequest).toHaveBeenCalledWith("p1"));
    expect(screen.queryByText("edited@example.com")).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Removed edited@example.com");
  });

  it("bulk moves, clears selection, deletes, and rolls back on failed bulk delete", async () => {
    const user = userEvent.setup();
    const one = person({ id: "one", email: "one@example.com", step: "eval" });
    const two = person({ id: "two", email: "two@example.com", step: "eval" });
    bulkRequest
      .mockResolvedValueOnce({ updated: [{ ...one, step: "gmail_creation" }] })
      .mockRejectedValueOnce(new Error("Bulk delete failed"));

    render(<Board initialPeople={[one, two]} />);

    await user.click(screen.getByLabelText("Select one@example.com"));
    await user.click(screen.getByLabelText("Select two@example.com"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Move to/ }));
    await user.click(screen.getByRole("button", { name: "Gmail Creation" }));
    await waitFor(() =>
      expect(bulkRequest).toHaveBeenCalledWith({
        action: "move",
        ids: ["one", "two"],
        step: "gmail_creation",
      }),
    );
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Select one@example.com"));
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Bulk delete failed"),
    );
    expect(screen.getByText("one@example.com")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Clear selection"));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
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

    render(<Board initialPeople={[existing]} />);

    await user.click(screen.getByLabelText("Open menu for rollback@example.com"));
    await user.click(screen.getByRole("button", { name: "Interview" }));
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
});
