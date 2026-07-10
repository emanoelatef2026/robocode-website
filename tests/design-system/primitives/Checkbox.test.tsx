import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "@/design-system/primitives/Checkbox";

describe("Checkbox", () => {
  it("toggles on click and reports state via role=checkbox", async () => {
    const user = userEvent.setup();
    render(<Checkbox>Accept terms</Checkbox>);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("toggles via keyboard (Space) once focused", async () => {
    const user = userEvent.setup();
    render(<Checkbox>Accept terms</Checkbox>);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("supports controlled usage via checked/onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onCheckedChange}>Accept terms</Checkbox>);
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("sets the native indeterminate property, not just a visual class", () => {
    render(<Checkbox indeterminate>Partial selection</Checkbox>);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
  });

  it("is disabled and unresponsive to clicks", async () => {
    const user = userEvent.setup();
    render(<Checkbox disabled>Accept terms</Checkbox>);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
