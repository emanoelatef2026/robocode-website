import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "@/design-system/primitives/SearchInput";

describe("SearchInput", () => {
  it("shows a clear button only once there is a value, and clearing empties the field", async () => {
    const user = userEvent.setup();
    render(<SearchInput aria-label="Search" />);
    const input = screen.getByLabelText("Search");

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await user.type(input, "robotics");
    expect(input).toHaveValue("robotics");
    const clear = screen.getByRole("button", { name: "Clear search" });

    await user.click(clear);
    expect(input).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("fires onSearch with the current value when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchInput aria-label="Search" onSearch={onSearch} />);
    await user.type(screen.getByLabelText("Search"), "groups{Enter}");
    expect(onSearch).toHaveBeenCalledWith("groups");
  });

  it("supports fully controlled usage via value/onValueChange", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("");
      return <SearchInput aria-label="Search" value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    await user.type(screen.getByLabelText("Search"), "x");
    expect(screen.getByLabelText("Search")).toHaveValue("x");
  });
});
