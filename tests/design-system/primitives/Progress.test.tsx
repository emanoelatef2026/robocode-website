import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "@/design-system/primitives/Progress";

describe("Progress", () => {
  it("exposes the standard aria-value triad", () => {
    render(<Progress value={40} label="Uploading" />);
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value to the min/max range", () => {
    render(<Progress value={999} max={10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });

  it("shows the numeric value/max text when showValue is set", () => {
    render(<Progress value={3} max={10} showValue />);
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });

  it("omits aria-valuenow and uses aria-valuetext when indeterminate", () => {
    render(<Progress indeterminate label="Loading" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-valuetext", "Loading");
  });
});
