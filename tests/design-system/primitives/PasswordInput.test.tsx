import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "@/design-system/primitives/PasswordInput";

describe("PasswordInput", () => {
  it("masks input by default", () => {
    render(<PasswordInput aria-label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("reveals and re-hides the value via the toggle button, operable by keyboard", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    const hideToggle = screen.getByRole("button", { name: "Hide password" });

    hideToggle.focus();
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "password");
  });
});
