import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import AccreditationsSection from "@/components/AccreditationsSection";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("renders logos without links or hover/focus targets even when CMS URLs exist", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [
    { id: "1", name: "Codeavoure International", logo_url: "/old.png", website_url: "https://example.com" },
    { id: "2", name: "fll", logo_url: "/old.png", website_url: "https://example.com" },
  ] }));
  render(<AccreditationsSection />);
  await screen.findByRole("img", { name: "MIT App Inventor" });
  const section = document.getElementById("accreditations")!;
  expect(within(section).getAllByRole("img")).toHaveLength(2);
  expect(section.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
  const css = readFileSync("components/public-site/LearningLogoFrame.module.css", "utf8");
  expect(css).toMatch(/\.card\s*\{[^}]*background: transparent/);
  expect(css).not.toMatch(/:hover|:focus|transition:|cursor:\s*pointer/);
});
