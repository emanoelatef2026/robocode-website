import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/design-system/primitives/Select";

const OPTIONS = [
  { value: "cairo", label: "Cairo" },
  { value: "giza", label: "Giza" },
];

describe("Select", () => {
  it("renders every option and selects via keyboard/native change", async () => {
    const user = userEvent.setup();
    render(<Select aria-label="Branch" options={OPTIONS} />);
    const select = screen.getByLabelText("Branch") as HTMLSelectElement;
    await user.selectOptions(select, "giza");
    expect(select).toHaveValue("giza");
  });

  it("renders a disabled placeholder option when provided", () => {
    render(<Select aria-label="Branch" options={OPTIONS} placeholder="Choose a branch" />);
    const placeholderOption = screen.getByText("Choose a branch") as HTMLOptionElement;
    expect(placeholderOption.disabled).toBe(true);
  });

  it("marks itself invalid and links helper text", () => {
    render(<Select aria-label="Branch" options={OPTIONS} invalid helperText="A branch is required." />);
    const select = screen.getByLabelText("Branch");
    expect(select).toHaveAttribute("aria-invalid", "true");
    const describedBy = select.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy!)).toHaveTextContent("A branch is required.");
  });

  it("respects disabled state", () => {
    render(<Select aria-label="Branch" options={OPTIONS} disabled />);
    expect(screen.getByLabelText("Branch")).toBeDisabled();
  });
});
