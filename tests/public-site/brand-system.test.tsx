import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { isPublicSitePath } from "@/lib/public-site/routes";
import { Button, ButtonLink } from "@/components/ui/Button";
import PublicSiteTheme from "@/components/public-site/PublicSiteTheme";
import { LIGHT_SEMANTIC_COLOR } from "@/design-system/tokens/semantic/color";
import { meetsContrastAA } from "@/design-system/utils/contrast";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
afterEach(cleanup);

describe("public brand boundary", () => {
  it.each(["/", "/book-session", "/blog", "/blog/example", "/terms-and-conditions", "/refund-policy", "/privacy-policy", "/login", "/forgot-password", "/reset-password", "/verify/example"])("includes %s", (path) => expect(isPublicSitePath(path)).toBe(true));
  it.each(["/admin", "/admin/groups", "/portal/student", "/portal/instructor", "/portal/parent", "/portal/team-leader", "/studio", "/account/profile", "/select-workspace", "/blog-admin"])("never restyles %s", (path) => expect(isPublicSitePath(path)).toBe(false));
  it("adds the public scope only for public routes", () => {
    route.path = "/book-session";
    const { container, rerender } = render(<PublicSiteTheme><p>Content</p></PublicSiteTheme>);
    expect(container.querySelector("[data-public-site]")).toBeInTheDocument();
    route.path = "/portal/student";
    rerender(<PublicSiteTheme><p>Content</p></PublicSiteTheme>);
    expect(container.querySelector("[data-public-site]")).toBeNull();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});

describe("shared marketing actions", () => {
  it("preserves aria, events and href for internal links", () => {
    const click = vi.fn();
    render(<ButtonLink href="#contact" aria-label="Contact academy" onClick={click}>Contact</ButtonLink>);
    fireEvent.click(screen.getByRole("link", { name: "Contact academy" }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("link")).toHaveAttribute("href", "#contact");
  });
  it("keeps disabled buttons and submit semantics", () => {
    render(<Button disabled type="submit">Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
  it("uses contrast-safe existing semantic brand colors", () => {
    expect(meetsContrastAA("#FFFFFF", LIGHT_SEMANTIC_COLOR.brand.accentStrong)).toBe(true);
    expect(meetsContrastAA("#FFFFFF", LIGHT_SEMANTIC_COLOR.brand.primary)).toBe(true);
    expect(meetsContrastAA(LIGHT_SEMANTIC_COLOR.text.tertiary, "#FFFFFF")).toBe(true);
  });
});
