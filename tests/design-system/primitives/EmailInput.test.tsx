import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmailInput } from "@/design-system/primitives/EmailInput";

describe("EmailInput", () => {
  it("renders as an HTML5 email input with email autofill hints", () => {
    render(<EmailInput aria-label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
  });

  it("flags an invalid email via the shared invalid/helperText contract", () => {
    render(<EmailInput aria-label="Email" invalid helperText="Not a valid email." />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
