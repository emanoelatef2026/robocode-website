import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "@/design-system/primitives/Label";

describe("Label", () => {
  it("renders its text content", () => {
    render(<Label htmlFor="x">Group name</Label>);
    expect(screen.getByText("Group name")).toBeInTheDocument();
  });

  it("shows a required marker that is hidden from the accessibility tree", () => {
    render(<Label htmlFor="x" required>Group name</Label>);
    const mark = screen.getByText("*");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });
});
