import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/design-system/primitives/Input";
import { Label } from "@/design-system/primitives/Label";

describe("Input", () => {
  it("accepts typed input", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Name" />);
    const input = screen.getByLabelText("Name");
    await user.type(input, "Ada Lovelace");
    expect(input).toHaveValue("Ada Lovelace");
  });

  it("associates with a Label via htmlFor/id", () => {
    render(
      <>
        <Label htmlFor="student-name">Student name</Label>
        <Input id="student-name" />
      </>
    );
    expect(screen.getByLabelText("Student name")).toBeInTheDocument();
  });

  it("marks itself invalid and links helper text via aria-describedby", () => {
    render(<Input aria-label="Email" invalid helperText="Enter a valid email." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Enter a valid email.");
  });

  it("is disabled and does not accept input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Disabled field" disabled onChange={onChange} />);
    const input = screen.getByLabelText("Disabled field");
    expect(input).toBeDisabled();
    await user.type(input, "nope");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards a ref to the underlying <input>", () => {
    let node: HTMLInputElement | null = null;
    render(
      <Input
        aria-label="Ref test"
        ref={(el) => {
          node = el;
        }}
      />
    );
    expect(node).toBeInstanceOf(HTMLInputElement);
  });
});
