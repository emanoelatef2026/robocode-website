import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ONLINE_PROGRAMS } from "@/lib/public-site/online-programs";
import { PATHWAY_TOOLS, PATHWAY_VISUALS } from "@/lib/public-site/pathway-visuals";

describe("local pathway assets", () => {
  it.each(ONLINE_PROGRAMS)("has a light cover and four referenced semesters for $id", (program) => {
    const visual = PATHWAY_VISUALS[program.id];
    expect(visual.image).toBe(`/images/pathways/content-${program.ages[0]}-${program.ages[1]}-v1.webp`);
    expect(visual.semesterTools).toHaveLength(4);
    expect(statSync(resolve("public" + visual.image)).size).toBeLessThan(100_000);
    for (const locale of ["ar", "en"] as const) {
      expect(visual.title[locale].length).toBeLessThan(35);
      expect(visual.summary[locale].length).toBeLessThan(65);
    }
    for (const semester of visual.semesterTools) {
      expect(semester.length).toBeGreaterThan(0);
      for (const tool of semester) expect(PATHWAY_TOOLS[tool]).toBeDefined();
    }
  });
  it("stores every logo locally with an HTTPS reference and no executable SVG", () => {
    for (const tool of Object.values(PATHWAY_TOOLS)) {
      const path = resolve("public/images/pathways/tools", tool.image);
      expect(existsSync(path)).toBe(true);
      expect(tool.source).toMatch(/^https:\/\//);
      if (path.endsWith(".svg")) expect(readFileSync(path, "utf8")).not.toMatch(/<script|<foreignObject|onload=|javascript:/i);
    }
  });
});
