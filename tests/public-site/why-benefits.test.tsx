import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import WhySection from "@/components/WhySection";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { resolvePath } from "@/lib/i18n";

const language = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    locale: language.locale,
    t: (key: string) => resolvePath((language.locale === "ar" ? ar : en) as Record<string, unknown>, key),
  }),
}));
beforeEach(() => { language.locale = "en"; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("compact Why Robocode", () => {
  it.each(["ar", "en"])("renders four illustrated benefits immediately in %s without tabs or data requests", (locale) => {
    language.locale = locale;
    const { container } = render(<WhySection />);
    const dictionary = locale === "ar" ? ar : en;
    const section = screen.getByRole("region", { name: locale === "ar" ? "لماذا Robocode؟" : "Why Robocode?" });
    expect(section).toHaveAttribute("id", "why");
    expect(within(section).getAllByRole("heading", { level: 2 })).toHaveLength(1);
    const benefits = within(section).getAllByRole("listitem");
    expect(benefits).toHaveLength(4);
    Object.values(dictionary.why.compact).forEach((benefit) => {
      expect(within(section).getByRole("heading", { level: 3, name: benefit.title })).toBeVisible();
      expect(within(section).getByText(benefit.description)).toBeVisible();
    });
    expect(container.querySelectorAll("button, a, svg, [role=tab], [role=tablist]")).toHaveLength(0);
    expect(within(section).getAllByRole("img")).toHaveLength(4);
    Object.values(dictionary.why.compact).forEach((benefit) => {
      expect(within(section).getByRole("img", { name: benefit.imageAlt })).toHaveAttribute("loading", "lazy");
    });
    expect(container.textContent).not.toContain("No image uploaded");
    expect(container.textContent).not.toContain("why.compact");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("switches all benefit copy and the section title together", () => {
    const { rerender } = render(<WhySection />);
    language.locale = "ar";
    rerender(<WhySection />);
    expect(screen.getByRole("heading", { name: "لماذا Robocode؟" })).toBeInTheDocument();
    expect(screen.queryByText(en.why.compact.projects.title)).not.toBeInTheDocument();
    expect(screen.getByText(ar.why.compact.projects.title)).toBeInTheDocument();
  });
  it("uses image-and-copy mobile rows, tablet pairs and desktop columns without clipping copy", () => {
    const css = readFileSync(resolve("components/public-site/WhyBenefits.module.css"), "utf8");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(4, minmax(0, 1fr))");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain("max-width: 248px");
    expect(css).not.toContain("mix-blend-mode");
    expect(css).toContain("width: 80px; height: 80px");
    expect(css).not.toMatch(/line-clamp|max-height|overflow-x|scroll-snap|text-overflow/);
    expect(css).not.toContain("box-shadow");
  });
  it("keeps benefit descriptions short in both languages", () => {
    [ar, en].forEach((dictionary) => Object.values(dictionary.why.compact).forEach((benefit) => {
      expect(benefit.title.length).toBeLessThanOrEqual(24);
      expect(benefit.description.length).toBeLessThanOrEqual(40);
    }));
  });
  it("ships four optimized cutouts with real alpha rather than opaque rectangular images", async () => {
    for (const key of ["projects", "attention", "progress", "pathway"]) {
      const path = resolve("public/images/why", key + "-v2-transparent.webp");
      const bytes = readFileSync(path);
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      expect(statSync(path).size).toBeLessThan(100_000);
      const metadata = await sharp(path).metadata();
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBe(512);
      const stats = await sharp(path).stats();
      expect(stats.channels[3].min).toBe(0);
      expect(stats.channels[3].max).toBe(255);
    }
  });
});
