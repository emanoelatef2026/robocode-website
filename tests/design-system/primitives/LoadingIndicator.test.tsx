import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingIndicator } from "@/design-system/primitives/LoadingIndicator";

describe("LoadingIndicator", () => {
  it("announces the default 'Loading' label via a live region", () => {
    render(<LoadingIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("announces a custom label", () => {
    render(<LoadingIndicator label="Fetching students…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Fetching students…");
  });
});
