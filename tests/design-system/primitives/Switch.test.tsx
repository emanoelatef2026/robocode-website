import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "@/design-system/primitives/Switch";

describe("Switch", () => {
  it("exposes role=switch and toggles aria-checked on click", async () => {
    const user = userEvent.setup();
    render(<Switch>Enable notifications</Switch>);
    const toggle = screen.getByRole("switch", { name: "Enable notifications" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
  });

  it("toggles via keyboard (Space)", async () => {
    const user = userEvent.setup();
    render(<Switch>Enable notifications</Switch>);
    const toggle = screen.getByRole("switch");
    toggle.focus();
    await user.keyboard(" ");
    expect(toggle).toBeChecked();
  });

  it("supports controlled usage via checked/onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        Enable notifications
      </Switch>
    );
    await user.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is disabled and unresponsive to clicks", async () => {
    const user = userEvent.setup();
    render(<Switch disabled>Enable notifications</Switch>);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });
});
