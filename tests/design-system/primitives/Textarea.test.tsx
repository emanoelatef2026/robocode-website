import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "@/design-system/primitives/Textarea";

describe("Textarea", () => {
  it("accepts multi-line typed input", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByLabelText("Notes");
    await user.type(textarea, "Line one{Enter}Line two");
    expect(textarea).toHaveValue("Line one\nLine two");
  });

  it("marks itself invalid and links helper text", () => {
    render(<Textarea aria-label="Notes" invalid helperText="Notes cannot be empty." />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    const describedBy = textarea.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Notes cannot be empty.");
  });

  it("respects disabled state", () => {
    render(<Textarea aria-label="Notes" disabled />);
    expect(screen.getByLabelText("Notes")).toBeDisabled();
  });
});
