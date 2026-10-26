import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { statSync } from "node:fs";
import { mapHomepageLearningLogos } from "@/lib/public-site/learning-logos";

describe("homepage learning logos", () => {
  const items = [
    { id: "1", name: "Codeavoure International", logo_url: "/old-codeavour.png", website_url: "https://old.example" },
    { id: "2", name: "code.org", logo_url: "/code.png" },
    { id: "3", name: "stem.org", logo_url: "/stem.png" },
    { id: "4", name: "fll", logo_url: "/old-fll.png" },
  ];
  it("replaces only the two requested logos, names and destinations without mutating records", () => {
    const result = mapHomepageLearningLogos(items);
    expect(result.map(item => item.name)).toEqual(["MIT App Inventor", "code.org", "stem.org", "Microsoft"]);
    expect(result.map(item => item.id)).toEqual(items.map(item => item.id));
    expect(result[0].website_url).toBe("https://appinventor.mit.edu/");
    expect(result[3].website_url).toBe("https://www.microsoft.com/");
    expect(result[1]).toBe(items[1]);
    expect(result[2]).toBe(items[2]);
    expect(items[0].name).toBe("Codeavoure International");
    expect(items[3].name).toBe("fll");
  });
  it("ships real readable local logo assets", async () => {
    for (const item of mapHomepageLearningLogos(items).filter(item => ["1", "4"].includes(item.id))) {
      const path = "public" + item.logo_url;
      const metadata = await sharp(path).metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.width).toBeGreaterThan(50);
      expect(statSync(path).size).toBeLessThan(100_000);
    }
  });
});
