import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgramsSection from "@/components/public-site/ProgramsSection";
import OnlinePricingSection from "@/components/public-site/OnlinePricingSection";

const language = vi.hoisted(() => ({ locale: "en" as "en" | "ar" }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ locale: language.locale, dir: language.locale === "ar" ? "rtl" : "ltr" }),
}));

beforeEach(() => {
  language.locale = "en";
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("homepage pathway cards", () => {
  it("renders four complete cards and no links to unbuilt detail pages", () => {
    const { container } = render(<ProgramsSection />);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: /^View pathway details:/ })).toHaveLength(4);
    expect(container.querySelectorAll('a[href^="/programs/"]')).toHaveLength(0);
    expect(document.getElementById("learning-journey")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Explore online prices/ })).not.toBeInTheDocument();
  });
  it("opens useful details without navigation and restores body scrolling on close", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    render(<ProgramsSection />);
    await user.click(screen.getByRole("button", { name: "View pathway details: First Steps into Coding" }));
    const dialog = screen.getByRole("dialog", { name: "First Steps into Coding" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(4);
    expect(within(dialog).getByText("Interactive Stories")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByRole("link", { name: "Book an Online Trial" })).toHaveAttribute("href", "/book-session");
    await user.click(within(dialog).getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
  });
  it("responds to the native dialog close event (including browser Escape)", async () => {
    render(<ProgramsSection />);
    fireEvent.click(screen.getByRole("button", { name: "View pathway details: From Python to Artificial Intelligence" }));
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not close for clicks inside the dialog/scrollbar, but closes for the backdrop", () => {
    render(<ProgramsSection />);
    fireEvent.click(screen.getByRole("button", { name: "View pathway details: First Steps into Coding" }));
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 300, 500));
    fireEvent.click(dialog, { clientX: 305, clientY: 300 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog, { clientX: 5, clientY: 5 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("renders Arabic copy with isolated left-to-right age ranges", async () => {
    language.locale = "ar";
    const { container } = render(<ProgramsSection />);
    expect(container.querySelector("section")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("heading", { name: "رحلتهم الأولى في عالم البرمجة" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^تفاصيل المرحلة:/ })).toHaveLength(4);
    expect(container.querySelector('bdi[dir="ltr"]')).toHaveTextContent("6–8");
    fireEvent.click(screen.getByRole("button", { name: "تفاصيل المرحلة: من البرمجة إلى الذكاء الاصطناعي" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", "rtl");
    expect(within(screen.getByRole("dialog")).getByText("السيمستر 4")).toBeInTheDocument();
  });
});

describe("homepage online prices", () => {
  it.each(["en", "ar"] as const)("renders the two approved prices and boundaries in %s", (locale) => {
    language.locale = locale;
    const { container } = render(<OnlinePricingSection />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("2,800")).toBeInTheDocument();
    expect(screen.getByText("5,200")).toBeInTheDocument();
    expect(container.querySelector("section")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    expect(screen.getAllByText(locale === "ar" ? "للطالب / للسيمستر" : "per student / per semester")).toHaveLength(2);
    expect(screen.getAllByText(locale === "ar" ? "ساعة ونصف للحصة" : "90 minutes per class")).toHaveLength(1);
    expect(screen.getAllByText(locale === "ar" ? "12 حصة خلال 3 شهور" : "12 classes over 3 months")).toHaveLength(1);
    expect(screen.getByText(locale === "ar" ? "من 2 إلى 4 طلاب" : "2–4 students")).toBeInTheDocument();
    expect(container.textContent).not.toContain("payments are not collected");
    expect(container.textContent).not.toContain("لا يتم تحصيل مدفوعات");
    expect(container.querySelector("header")?.children).toHaveLength(1);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('a[href*="checkout"],a[href*="payment"]')).toBeNull();
  });
  it("uses real contact anchors for enquiries, not fake purchase actions", () => {
    render(<OnlinePricingSection />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("href", "#contact");
      expect(link).toHaveTextContent("Enquire");
    }
  });
});

describe("minimal public section headings", () => {
  it.each(["en", "ar"] as const)("has one title with no surrounding copy in %s", (locale) => {
    language.locale = locale;
    const { container } = render(<ProgramsSection />);
    const header = container.querySelector("section > header")!;
    expect(header.children).toHaveLength(1);
    expect(header.firstElementChild?.tagName).toBe("H2");
    expect(header).toHaveTextContent(locale === "ar" ? "المراحل التعليمية" : "Learning Pathways");
    expect(header.querySelector("p")).toBeNull();
  });
});
