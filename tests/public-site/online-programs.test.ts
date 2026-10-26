import { describe, expect, it } from "vitest";
import { ONLINE_PROGRAMS, ONLINE_PLANS, ONLINE_STUDY, ONLINE_COPY, formatOnlinePrice, resolveOnlineHomepageSections } from "@/lib/public-site/online-programs";

describe("approved online offer", () => {
  it("has the four exact approved age groups", () => {
    expect(ONLINE_PROGRAMS.map((program) => [...program.ages])).toEqual([[6, 8], [9, 11], [12, 14], [15, 17]]);
    expect(new Set(ONLINE_PROGRAMS.map((program) => program.id)).size).toBe(4);
  });
  it("keeps approved semester facts and prices independent of LMS data", () => {
    expect(ONLINE_STUDY).toMatchObject({ classes: 12, months: 3, minutes: 90, semesters: 4, groupMin: 2, groupMax: 4, currency: "EGP" });
    expect(ONLINE_PLANS).toEqual([{ id: "group", amount: 2800 }, { id: "one-to-one", amount: 5200 }]);
  });
  it.each(ONLINE_PROGRAMS)("has equivalent complete content and four semesters for $id", (program) => {
    expect(program.semesters).toHaveLength(4);
    for (const locale of ["ar", "en"] as const) {
      expect(program.title[locale].length).toBeGreaterThan(5);
      expect(program.description[locale].length).toBeGreaterThan(25);
      expect(program.skills.length).toBeGreaterThanOrEqual(3);
      expect(program.skills.every((skill) => skill[locale].length > 1)).toBe(true);
      expect(program.semesters.every((semester) => semester.title[locale].length > 2 && semester.description[locale].length > 10)).toBe(true);
    }
  });
  it("does not reintroduce the old unapproved topic catalog", () => {
    const content = JSON.stringify(ONLINE_PROGRAMS);
    for (const legacy of ["Roblox", "Minecraft", "React", "Arduino", "VR", "startup", "production-grade"]) expect(content).not.toContain(legacy);
  });
  it("makes the semester-only, online-only and no-payment limits explicit in both languages", () => {
    expect(ONLINE_COPY.en.priceNote).toContain("not the complete four-semester pathway");
    expect(ONLINE_COPY.ar.priceNote).toContain("وليس للمسار الكامل");
    expect(ONLINE_COPY.en.priceNote).toContain("online classes only");
    expect(ONLINE_COPY.ar.priceNote).toContain("الأونلاين فقط");
    expect(ONLINE_COPY.en.noPayment).toContain("payments are not collected");
    expect(ONLINE_COPY.ar.noPayment).toContain("لا يتم تحصيل مدفوعات");
  });
  it.each(["ar", "en"] as const)("formats readable EGP amounts in %s", (locale) => {
    expect(formatOnlinePrice(2800, locale)).toBe("2,800");
    expect(formatOnlinePrice(5200, locale)).toBe("5,200");
  });
});

describe("homepage section integration", () => {
  it("places the existing accreditation gallery immediately after Why Robocode without duplicates", () => {
    const result = resolveOnlineHomepageSections(["hero", "trust", "why", "programs", "branches", "accreditations", "accreditations", "contact"]);
    expect(result).toEqual(["hero", "trust", "why", "accreditations", "programs", "online_pricing", "branches", "contact"]);
    expect(resolveOnlineHomepageSections(result)).toEqual(result);
  });
  it("places Why Robocode before the approved offer even when the legacy catalog is hidden", () => {
    expect(resolveOnlineHomepageSections(["hero", "trust", "why", "learning_journey", "branches", "contact"]))
      .toEqual(["hero", "trust", "why", "programs", "online_pricing", "branches", "contact"]);
  });
  it("removes only the redundant old roadmap and does not enable hidden unrelated content", () => {
    const result = resolveOnlineHomepageSections(["hero", "why", "learning_journey", "faq"]);
    expect(result).toEqual(["hero", "why", "programs", "online_pricing", "faq"]);
    expect(result).not.toContain("projects");
    expect(result).not.toContain("competitions");
  });
  it("does not duplicate catalog or prices if settings already contain them", () => {
    const result = resolveOnlineHomepageSections(["hero", "programs", "online_pricing", "programs", "contact"]);
    expect(result.filter((key) => key === "programs")).toHaveLength(1);
    expect(result.filter((key) => key === "online_pricing")).toHaveLength(1);
    expect(resolveOnlineHomepageSections(result)).toEqual(result);
  });
  it("works with an empty section configuration", () => {
    expect(resolveOnlineHomepageSections([])).toEqual(["programs", "online_pricing"]);
  });
  it("keeps hidden Why Robocode hidden and falls back to the trust strip", () => {
    expect(resolveOnlineHomepageSections(["hero", "trust", "branches"]))
      .toEqual(["hero", "trust", "programs", "online_pricing", "branches"]);
  });
  it("preserves the requested order on repeated resolution", () => {
    const result = resolveOnlineHomepageSections(["hero", "trust", "programs", "online_pricing", "why", "faq"]);
    expect(result.indexOf("why")).toBeLessThan(result.indexOf("programs"));
    expect(resolveOnlineHomepageSections(result)).toEqual(result);
  });
});
