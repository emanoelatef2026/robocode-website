import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "@/design-system/primitives/Tooltip";
import styles from "@/design-system/primitives/primitives.module.css";

describe("Tooltip", () => {
  it("always links the trigger to the tooltip via aria-describedby", () => {
    render(
      <Tooltip content="Saves the group" delay={0}>
        <button>Save</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Save" });
    const tooltip = screen.getByRole("tooltip");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("becomes visible on hover and hides again on mouse leave", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Saves the group" delay={0}>
        <button>Save</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Save" });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).not.toContain(styles.tooltipVisible);

    await user.hover(trigger);
    await waitFor(() => expect(tooltip.className).toContain(styles.tooltipVisible));

    await user.unhover(trigger);
    expect(tooltip.className).not.toContain(styles.tooltipVisible);
  });

  it("becomes visible on keyboard focus and hides on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Saves the group" delay={0}>
        <button>Save</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Save" });
    const tooltip = screen.getByRole("tooltip");

    trigger.focus();
    await waitFor(() => expect(tooltip.className).toContain(styles.tooltipVisible));

    await user.keyboard("{Escape}");
    expect(tooltip.className).not.toContain(styles.tooltipVisible);
  });
});
