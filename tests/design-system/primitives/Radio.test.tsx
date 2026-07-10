import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Radio } from "@/design-system/primitives/Radio";

describe("Radio", () => {
  it("lets exactly one option in a shared name group be selected", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Radio name="plan" value="monthly">
          Monthly
        </Radio>
        <Radio name="plan" value="yearly">
          Yearly
        </Radio>
      </>
    );
    const monthly = screen.getByRole("radio", { name: "Monthly" });
    const yearly = screen.getByRole("radio", { name: "Yearly" });

    await user.click(monthly);
    expect(monthly).toBeChecked();
    expect(yearly).not.toBeChecked();

    await user.click(yearly);
    expect(yearly).toBeChecked();
    expect(monthly).not.toBeChecked();
  });

  it("moves selection via ArrowDown between radios in the same group", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Radio name="plan" value="monthly" defaultChecked>
          Monthly
        </Radio>
        <Radio name="plan" value="yearly">
          Yearly
        </Radio>
      </>
    );
    screen.getByRole("radio", { name: "Monthly" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Yearly" })).toBeChecked();
  });

  it("is disabled and unresponsive to clicks", async () => {
    const user = userEvent.setup();
    render(
      <Radio name="plan" value="trial" disabled>
        Trial
      </Radio>
    );
    const radio = screen.getByRole("radio");
    expect(radio).toBeDisabled();
    await user.click(radio);
    expect(radio).not.toBeChecked();
  });
});
