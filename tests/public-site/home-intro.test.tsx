import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Hero from "@/components/Hero";
import TrustSection from "@/components/TrustSection";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { resolvePath } from "@/lib/i18n";

const language = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => resolvePath((language.locale === "ar" ? ar : en) as Record<string, unknown>, key),
  }),
}));
beforeEach(() => {
  language.locale = "en";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => null }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("compact homepage introduction", () => {
  it.each(["en", "ar"])("keeps one heading and the two working CTAs in %s before the image", (locale) => {
    language.locale = locale;
    const { container } = render(<Hero />);
    const dictionary = locale === "ar" ? ar : en;
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const booking = screen.getByRole("link", { name: dictionary.hero.bookSession });
    expect(booking).toHaveAttribute("href", "/book-session");
    expect(screen.getByRole("link", { name: dictionary.hero.explorePrograms })).toHaveAttribute("href", "#programs");
    const image = screen.getByRole("img", { name: dictionary.hero.imageAlt });
    expect(booking.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image).toHaveAttribute("sizes", expect.stringContaining("360px"));
    expect(container.textContent).not.toContain("hero.");
  });
  it("uses a CMS image and falls back if that image fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ image_url: "/custom-hero.png" }) } as Response);
    render(<Hero />);
    const image = screen.getByRole("img");
    await waitFor(() => expect(image.getAttribute("src")).toContain("custom-hero.png"));
    fireEvent.error(image);
    await waitFor(() => expect(image.getAttribute("src")).toContain("hero-kids.png"));
  });
  it("keeps a valid default image when the CMS is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    render(<Hero />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.getByRole("img").getAttribute("src")).toContain("hero-kids.png");
  });
  it.each(["en", "ar"])("retains all four existing figures in a semantic strip in %s", (locale) => {
    language.locale = locale;
    const { container } = render(<TrustSection />);
    expect(container.querySelectorAll("dl dt")).toHaveLength(4);
    expect(Array.from(container.querySelectorAll("dd")).map((node) => node.textContent)).toEqual(["6+", "8000+", "16000+", "4.9/5"]);
    expect(container.querySelectorAll("h2, button, a, [data-site-card]")).toHaveLength(0);
    expect(container.querySelectorAll('dd svg[aria-hidden="true"][focusable="false"]')).toHaveLength(4);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
  it("caps hero artwork and uses logical borders with a 2-to-4 column stats layout", () => {
    const css = readFileSync(resolve("components/public-site/HomeIntro.module.css"), "utf8");
    expect(css).toContain("minmax(0, 360px)");
    expect(css).toContain("max-width: 1120px");
    expect(css).toContain("padding-top: 132px; padding-bottom: 16px");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(4, minmax(0, 1fr))");
    expect(css).toContain("border-inline-start");
    expect(css).not.toContain("transform");
  });
});
