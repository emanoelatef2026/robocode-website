import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Separator } from "@/design-system/primitives/Separator";

describe("Separator", () => {
  it("exposes role=separator with its orientation by default", () => {
    render(<Separator orientation="vertical" />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });

  it("is removed from the accessibility tree when decorative", () => {
    render(<Separator decorative />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
