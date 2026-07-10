import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SKELETON_VARIANTS } from "@/design-system/primitives/Skeleton";

describe("Skeleton", () => {
  it("is hidden from the accessibility tree (purely visual placeholder)", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the requested width/height as inline style", () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("16px");
  });

  it("renders every declared variant without crashing", () => {
    for (const variant of SKELETON_VARIANTS) {
      const { container, unmount } = render(<Skeleton variant={variant} />);
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    }
  });
});
