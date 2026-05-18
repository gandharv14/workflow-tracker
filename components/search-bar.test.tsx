import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "./search-bar";

describe("SearchBar", () => {
  it("reports changes and clears the search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <SearchBar value="" onChange={onChange} resultCount={0} totalCount={3} />,
    );

    await user.type(screen.getByLabelText("Search people"), "jane");
    expect(onChange).toHaveBeenCalled();

    rerender(
      <SearchBar value="jane" onChange={onChange} resultCount={1} totalCount={3} />,
    );
    expect(screen.getByText("1/3")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Clear search"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
