import { describe, expect, it } from "vitest";
import { PUBLIC_NAV_LINKS } from "@/lib/public-site/navigation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("released public navigation", () => {
  it("contains only the five released destinations", () => {
    expect(PUBLIC_NAV_LINKS.map((link) => link.href)).toEqual(["/", "/#why", "/#programs", "/#branches", "/#contact"]);
    expect(new Set(PUBLIC_NAV_LINKS.map((link) => link.href)).size).toBe(5);
  });
  it("shares exactly the same menu in desktop and mobile", () => {
    const navbar = readFileSync(resolve(process.cwd(), "components/Navbar.tsx"), "utf8");
    expect(navbar.match(/PUBLIC_NAV_LINKS\.map/g)).toHaveLength(2);
    expect(navbar).not.toContain('href: "/#projects"');
    expect(navbar).not.toContain('href: "/#competitions"');
  });
  it("does not retain the unavailable competition link in the footer", () => {
    expect(readFileSync(resolve(process.cwd(), "components/Footer.tsx"), "utf8")).not.toContain('/#competitions');
  });
});
