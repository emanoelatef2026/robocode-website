import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollArea } from "@/design-system/primitives/ScrollArea";

describe("ScrollArea", () => {
  it("is a focusable, labeled region so keyboard users can scroll it", () => {
    render(
      <ScrollArea aria-label="Student list" maxHeight={100}>
        <p>Content</p>
      </ScrollArea>
    );
    const region = screen.getByRole("region", { name: "Student list" });
    expect(region).toHaveAttribute("tabIndex", "0");
  });

  it("applies the requested maxHeight", () => {
    render(
      <ScrollArea aria-label="Student list" maxHeight={120}>
        <p>Content</p>
      </ScrollArea>
    );
    expect(screen.getByRole("region")).toHaveStyle({ maxHeight: "120px" });
  });
});
