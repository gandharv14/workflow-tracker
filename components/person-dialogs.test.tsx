import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddPersonDialog } from "./add-person-dialog";
import { EditPersonDialog } from "./edit-person-dialog";
import { person } from "@/test/factories";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("AddPersonDialog", () => {
  it("initializes fields, validates email, submits data, and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddPersonDialog
        open
        initialStep="interview"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("button", { name: "Add person" })).toBeDisabled();

    await user.type(screen.getByLabelText("Email"), "bad");
    expect(screen.getByRole("button", { name: "Add person" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText(/Name/), "Jane Doe");
    expect(screen.getByLabelText("Workflow step")).toHaveValue("interview");
    await user.selectOptions(screen.getByLabelText("Workflow step"), "gmail_creation");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "person@example.com",
        name: "Jane Doe",
        step: "gmail_creation",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows loading and inline errors", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onSubmit = vi.fn().mockReturnValue(pending.promise);

    render(
      <AddPersonDialog
        open
        initialStep="eval"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    pending.resolve();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const failingSubmit = vi.fn().mockRejectedValue(new Error("Duplicate email"));
    render(
      <AddPersonDialog
        open
        initialStep="eval"
        onOpenChange={vi.fn()}
        onSubmit={failingSubmit}
      />,
    );
    await user.type(screen.getAllByLabelText("Email")[1], "person@example.com");
    await user.click(screen.getAllByRole("button", { name: "Add person" })[1]);
    expect(await screen.findByText("Duplicate email")).toBeInTheDocument();
  });

  it("cancels without submitting", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AddPersonDialog
        open
        initialStep="eval"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("EditPersonDialog", () => {
  it("loads the selected person, submits trimmed updates, and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const existing = person({
      id: "p1",
      email: "old@example.com",
      name: "Old Name",
    });

    render(
      <EditPersonDialog
        person={existing}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), " new@example.com ");
    await user.clear(screen.getByLabelText(/Name/));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("p1", {
        email: "new@example.com",
        name: null,
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("validates email, shows loading, displays errors, and cancels", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onSubmit = vi.fn().mockReturnValue(pending.promise);
    const onOpenChange = vi.fn();

    render(
      <EditPersonDialog
        person={person({ email: "edit@example.com" })}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "bad");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "edit@example.com");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    pending.resolve();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const failingSubmit = vi.fn().mockRejectedValue(new Error("Update failed"));
    render(
      <EditPersonDialog
        person={person({ id: "p2", email: "fail@example.com" })}
        onOpenChange={vi.fn()}
        onSubmit={failingSubmit}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Save changes" })[1]);
    expect(await screen.findByText("Update failed")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Cancel" })[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
