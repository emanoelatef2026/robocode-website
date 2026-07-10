import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Divider } from "@/design-system/primitives/Divider";

describe("Divider", () => {
  it("is hidden from the accessibility tree", () => {
    const { container } = render(<Divider />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a centered label when provided", () => {
    render(<Divider label="OR" />);
    expect(screen.getByText("OR")).toBeInTheDocument();
  });
});
