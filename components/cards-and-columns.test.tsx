import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BulkActionBar } from "./bulk-action-bar";
import { Column } from "./column";
import { PersonCard } from "./person-card";
import { person } from "@/test/factories";

describe("PersonCard", () => {
  it("renders person details, selection state, and basic card actions", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const existing = person({
      email: "jane@example.com",
      name: "Jane Doe",
      role: "Reviewer",
      step: "eval",
    });

    render(
      <PersonCard
        person={existing}
        selected
        onToggleSelect={onToggleSelect}
        onMove={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select jane@example.com"));
    expect(onToggleSelect).toHaveBeenCalledWith(existing.id);

    await user.click(screen.getByLabelText("Open menu for jane@example.com"));
    await user.click(await screen.findByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(existing);

    await user.click(screen.getByLabelText("Open menu for jane@example.com"));
    await user.click(await screen.findByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(existing.id);
  });

  it("falls back to email initials and exposes the drag handle", () => {
    render(
      <PersonCard
        person={person({ email: "no.name@example.com", name: undefined })}
        selected={false}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("no.name@example.com")).toBeInTheDocument();
    expect(screen.getByText("NN")).toBeInTheDocument();
    expect(screen.getByLabelText("Drag handle")).toBeInTheDocument();
  });
});

describe("Column", () => {
  it("renders counts, people, add action, and search-aware empty states", async () => {
    const user = userEvent.setup();
    const onAddHere = vi.fn();
    const onDownload = vi.fn();

    const { rerender } = render(
      <Column
        step="eval"
        people={[person({ id: "p1", email: "p1@example.com" })]}
        totalCount={3}
        hasActiveSearch
        selectedIds={new Set(["p1"])}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={onAddHere}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByText("Eval")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("p1@example.com")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Add to Eval"));
    expect(onAddHere).toHaveBeenCalledWith("eval");
    await user.click(screen.getByLabelText("Download Eval CSV"));
    expect(onDownload).toHaveBeenCalledWith("eval");

    rerender(
      <Column
        step="eval"
        people={[]}
        totalCount={3}
        hasActiveSearch
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("No matches in this column")).toBeInTheDocument();

    rerender(
      <Column
        step="eval"
        people={[]}
        totalCount={0}
        hasActiveSearch={false}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("Drop someone here or click + to add")).toBeInTheDocument();
  });

  it("renders the Email action only for the Sent Contracts column", async () => {
    const user = userEvent.setup();
    const onEmailSentContracts = vi.fn();

    const { rerender } = render(
      <Column
        step="sent_contracts"
        people={[]}
        totalCount={0}
        hasActiveSearch={false}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={vi.fn()}
        onDownload={vi.fn()}
        onEmailSentContracts={onEmailSentContracts}
      />,
    );

    expect(screen.getByRole("button", { name: "Email Sent Contracts" })).toBeDisabled();

    rerender(
      <Column
        step="sent_contracts"
        people={[person({ id: "sent", step: "sent_contracts" })]}
        totalCount={1}
        hasActiveSearch={false}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={vi.fn()}
        onDownload={vi.fn()}
        onEmailSentContracts={onEmailSentContracts}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Email Sent Contracts" }));
    expect(onEmailSentContracts).toHaveBeenCalledTimes(1);

    rerender(
      <Column
        step="eval"
        people={[]}
        totalCount={0}
        hasActiveSearch={false}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddHere={vi.fn()}
        onDownload={vi.fn()}
        onEmailSentContracts={onEmailSentContracts}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Email Sent Contracts" }),
    ).not.toBeInTheDocument();
  });
});

describe("BulkActionBar", () => {
  it("is hidden at zero count and exposes bulk clear, delete, and move actions", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <BulkActionBar
        count={0}
        onMove={onMove}
        onDelete={onDelete}
        onClear={onClear}
      />,
    );
    expect(screen.queryByText("0 selected")).not.toBeInTheDocument();

    rerender(
      <BulkActionBar
        count={2}
        onMove={onMove}
        onDelete={onDelete}
        onClear={onClear}
      />,
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Move to/ }));
    await user.click(await screen.findByText("Sent Contracts"));
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("sent_contracts"));

    await user.click(screen.getByRole("button", { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalled();

    await user.click(screen.getByLabelText("Clear selection"));
    expect(onClear).toHaveBeenCalled();
  });
});
