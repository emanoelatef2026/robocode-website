import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "@/design-system/primitives/NumberInput";

describe("NumberInput", () => {
  it("accepts typed numeric input", async () => {
    const user = userEvent.setup();
    render(<NumberInput aria-label="Quantity" />);
    const input = screen.getByLabelText("Quantity");
    await user.type(input, "42");
    expect(input).toHaveValue(42);
  });

  it("increments and decrements via the stepper buttons", async () => {
    const user = userEvent.setup();
    render(<NumberInput aria-label="Quantity" defaultValue={5} />);
    const input = screen.getByLabelText("Quantity");
    const [up, down] = screen.getAllByRole("button", { hidden: true });

    await user.click(up);
    expect(input).toHaveValue(6);
    await user.click(down);
    await user.click(down);
    expect(input).toHaveValue(4);
  });

  it("clamps to min/max and disables the stepper at each bound", async () => {
    const user = userEvent.setup();
    render(<NumberInput aria-label="Quantity" defaultValue={1} min={0} max={1} />);
    const [up, down] = screen.getAllByRole("button", { hidden: true });
    expect(up).toBeDisabled();

    await user.click(down);
    expect(screen.getByLabelText("Quantity")).toHaveValue(0);
    expect(down).toBeDisabled();
  });
});
