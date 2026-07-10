import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "@/design-system/primitives/IconButton";

describe("IconButton", () => {
  it("uses the required label prop as its accessible name", () => {
    render(<IconButton label="Delete row" icon={<span aria-hidden>x</span>} />);
    expect(screen.getByRole("button", { name: "Delete row" })).toBeInTheDocument();
  });

  it("fires onClick when activated", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Close" icon={<span aria-hidden>x</span>} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables the control and marks it busy while loading", () => {
    render(<IconButton label="Refresh" icon={<span aria-hidden>x</span>} loading />);
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
