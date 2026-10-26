import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import FAQSection from "@/components/FAQSection";
import PartnersSection from "@/components/PartnersSection";
import { HOMEPAGE_FAQ } from "@/lib/public-site/homepage-faq";

const language = vi.hoisted(() => ({ locale: "en" as "ar" | "en" }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ locale: language.locale }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); language.locale = "en"; });

describe("concise bilingual homepage FAQ", () => {
  it.each(["ar", "en"] as const)("shows exactly six localized questions with matching structured data in %s", locale => {
    language.locale = locale;
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<FAQSection />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    HOMEPAGE_FAQ.forEach(item => expect(screen.getByRole("button", { name: item[locale].question })).toHaveAttribute("aria-expanded", "false"));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(locale === "ar" ? "عندك سؤال آخر؟" : "Have another question?")).not.toBeInTheDocument();
    const schema = JSON.parse(container.querySelector("#faq-schema")!.textContent!);
    expect(schema.mainEntity).toHaveLength(6);
    expect(schema.mainEntity.map((item: {name: string}) => item.name)).toEqual(HOMEPAGE_FAQ.map(item => item[locale].question));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("opens and closes via keyboard, and keeps only one answer open", async () => {
    const user = userEvent.setup();
    render(<FAQSection />);
    const [first, second] = screen.getAllByRole("button");
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region")).toHaveLength(2); // FAQ section + one answer
    await user.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(second.getAttribute("aria-controls")!)!).not.toBeVisible();
  });
  it("switches questions, open answer and schema together", async () => {
    const { rerender } = render(<FAQSection />);
    await userEvent.click(screen.getByRole("button", { name: HOMEPAGE_FAQ[0].en.question }));
    language.locale = "ar";
    rerender(<FAQSection />);
    expect(screen.getByRole("button", { name: HOMEPAGE_FAQ[0].ar.question })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(HOMEPAGE_FAQ[0].ar.answer)).toBeVisible();
    expect(screen.queryByRole("link", { name: "تواصل معنا" })).not.toBeInTheDocument();
    expect(document.getElementById("faq-schema")!.textContent).toContain(HOMEPAGE_FAQ[0].ar.question);
    expect(screen.queryByText(HOMEPAGE_FAQ[0].en.question)).not.toBeInTheDocument();
  });
});

describe("static partner grid", () => {
  const partners = Array.from({ length: 6 }, (_, index) => ({ id: String(index), name: `Partner ${index}`, logo_url: `/partner-${index}.png`, website_url: index === 0 ? "https://example.com" : null }));
  it.each(["ar", "en"] as const)("renders each partner once with a localized heading in %s", async locale => {
    language.locale = locale;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [...partners, partners[0]] }));
    render(<PartnersSection />);
    const section = await screen.findByRole("region", { name: locale === "ar" ? "شركاؤنا" : "Our Partners" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(6);
    expect(within(section).getAllByRole("img")).toHaveLength(6);
    expect(within(section).getByRole("link", { name: "Partner 0" })).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.error(within(section).getByRole("img", { name: "Partner 1" }));
    expect(within(section).getByText("Partner 1")).toBeVisible();
  });
  it("keeps an empty partner collection hidden", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const { container } = render(<PartnersSection />);
    expect(container).toBeEmptyDOMElement();
  });
  it("uses mobile pairs and three desktop columns, without rail animation", () => {
    const css = readFileSync("components/public-site/HomepageSupport.module.css", "utf8");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
    expect(css).toMatch(/\.partner\s*\{[^}]*background: transparent/);
    expect(css).toContain(".partnerFrame");
    expect(css).toContain("mix-blend-mode: multiply");
    expect(css).not.toMatch(/animation:|@keyframes|marquee|translateX|scroll-snap/);
    expect(readFileSync("components/PartnersSection.tsx", "utf8")).not.toContain("LogoRail");
  });
  it("gives visible homepage sections one shared gap without stacked padding", () => {
    const theme = readFileSync("components/public-site/PublicSiteTheme.module.css", "utf8");
    expect(theme).toContain('[data-home-section]:has(section[id])');
    expect(theme).toMatch(/\[data-home-section\] section\[id\][^}]+padding-block: 0/);
    expect(theme).toContain("padding-bottom: var(--site-section-gap)");
    expect(theme).toContain("--site-section-gap: clamp(48px, 5vw, 64px)");
    expect(readFileSync("components/HomeSections.tsx", "utf8")).toContain("data-home-section={key}");
  });
});
