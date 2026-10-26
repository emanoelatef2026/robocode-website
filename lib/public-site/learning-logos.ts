interface LearningLogo {
  id: string;
  name: string;
  logo_url: string;
  website_url?: string | null;
}

// Homepage-only display substitutions; preserve CMS records and ordering.
export function mapHomepageLearningLogos(items: readonly LearningLogo[]): LearningLogo[] {
  return items.map((item) => {
    const name = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (name.includes("codeavour") || name.includes("codeavoure")) {
      return { ...item, name: "MIT App Inventor", logo_url: "/images/learning-logos/mit-app-inventor.png", website_url: "https://appinventor.mit.edu/" };
    }
    if (name === "fll" || name.includes("firstlegoleague")) {
      return { ...item, name: "Microsoft", logo_url: "/images/learning-logos/microsoft.png", website_url: "https://www.microsoft.com/" };
    }
    return item;
  });
}
