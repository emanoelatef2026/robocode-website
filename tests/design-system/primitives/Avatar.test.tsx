import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Avatar } from "@/design-system/primitives/Avatar";

describe("Avatar", () => {
  it("derives initials from a two-word name", () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("renders the provided image with the name as alt text", () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/ada.jpg" />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(img.tagName).toBe("IMG");
  });

  it("falls back to initials if the image fails to load", () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/broken.jpg" />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    fireEvent.error(img);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("announces its status via visually-hidden text", () => {
    render(<Avatar name="Ada Lovelace" status="online" />);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });
});
