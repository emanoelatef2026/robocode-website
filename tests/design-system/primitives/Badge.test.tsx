import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, BADGE_TONES } from "@/design-system/primitives/Badge";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("hides the decorative dot from the accessibility tree", () => {
    render(<Badge dot>Active</Badge>);
    const badge = screen.getByText("Active").closest("span")!;
    const dot = badge.querySelector("[aria-hidden='true']");
    expect(dot).toBeInTheDocument();
  });

  it("renders every declared tone without crashing", () => {
    for (const tone of BADGE_TONES) {
      const { unmount } = render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone)).toBeInTheDocument();
      unmount();
    }
  });
});
