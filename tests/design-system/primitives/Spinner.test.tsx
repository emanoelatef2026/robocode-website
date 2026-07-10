import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/design-system/primitives/Spinner";

describe("Spinner", () => {
  it("announces its label via a polite live region by default", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading");
  });

  it("announces a custom label", () => {
    render(<Spinner label="Saving changes" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saving changes");
  });

  it("renders decoratively (no status role) when label is empty", () => {
    render(<Spinner label="" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
