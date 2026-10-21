import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ProgramsSection from "@/components/public-site/ProgramsSection";
import styles from "@/components/public-site/OnlineOffer.module.css";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", dir: "ltr" }) }));
afterEach(cleanup);

function openFirstPathway() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } });
  render(<ProgramsSection />);
  fireEvent.click(screen.getByRole("button", { name: "View pathway details: First Steps into Coding" }));
  return screen.getByRole("dialog");
}

describe("pathway image framing regression", () => {
  it("separates the uncut dialog illustration from card cover cropping", () => {
    const dialog = openFirstPathway();
    expect(dialog.querySelector("img")).toHaveClass(styles.dialogCoverImage);
    const css = readFileSync(resolve("components/public-site/OnlineOffer.module.css"), "utf8");
    expect(css.match(/\.dialogCover\s*\{([^}]+)\}/)?.[1]).toContain("aspect-ratio: 3 / 2");
    expect(css.match(/\.dialogCoverImage\s*\{([^}]+)\}/)?.[1]).toContain("object-fit: contain");
  });
  it("bounds every logo with an absolute fill image instead of intrinsic grid sizing", () => {
    const dialog = openFirstPathway();
    for (const image of dialog.querySelectorAll("ol img")) {
      expect(image).toHaveAttribute("data-nimg", "fill");
      expect(image).toHaveClass(styles.toolLogoImage);
      expect(image.parentElement).toHaveClass(styles.toolLogo);
    }
  });
  it("gives horizontal wordmarks a wider frame without stretching square marks", () => {
    const dialog = openFirstPathway();
    const scratchJr = dialog.querySelector('img[alt="ScratchJr"]')!;
    expect(scratchJr.parentElement?.parentElement).toHaveClass(styles.toolBadgeWide);
    const code = dialog.querySelector('img[alt="Code.org"]')!;
    expect(code.parentElement?.parentElement).not.toHaveClass(styles.toolBadgeWide);
  });
  it("allows roadmap grid rows to shrink around wordmarks on small screens", () => {
    const css = readFileSync(resolve("components/public-site/OnlineOffer.module.css"), "utf8");
    expect(css.match(/\.roadmapItem\s*\{([^}]+)\}/)?.[1]).toContain("min-width: 0");
  });
});
