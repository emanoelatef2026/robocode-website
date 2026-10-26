import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Navbar from "@/components/Navbar";

const language = vi.hoisted(() => ({ setLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", setLocale: language.setLocale, t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("shared public grid and header", () => {
  it("uses one subtle static 60px grid on the public canvas", () => {
    const css = readFileSync(resolve("components/public-site/PublicSiteTheme.module.css"), "utf8");
    expect(css).toContain("--site-grid-size: 60px");
    expect(css).toContain("var(--navy) 5%, transparent");
    expect(css).toContain("background-image: var(--site-grid-image)");
    expect(css).toContain(".site > :where(main, div) { background-color: transparent; }");
    expect(css).not.toContain(":root");
  });
  it("keeps the previous plain header separate from the canvas grid", () => {
    render(<Navbar />);
    expect(screen.getByRole("banner")).toHaveClass("bg-[var(--bg)]");
    const source = readFileSync(resolve("components/Navbar.tsx"), "utf8");
    expect(source).not.toContain("site-grid");
    expect(source).not.toContain("Navbar.module.css");
  });
  it("keeps the five released destinations and mobile menu behavior", () => {
    render(<Navbar />);
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getAllByRole("link")).toHaveLength(5);
    const toggle = screen.getByRole("button", { name: "Toggle navigation menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("public-mobile-menu")).toBeInTheDocument();
    fireEvent.click(within(document.getElementById("public-mobile-menu")!).getByRole("button", { name: "AR" }));
    expect(language.setLocale).toHaveBeenCalledWith("ar");
  });
});
