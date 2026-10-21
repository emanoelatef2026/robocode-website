// Idempotent, allowlisted mechanical migration. Never walks portals or data files.
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "app/page.tsx", "app/book-session/page.tsx", "app/blog/page.tsx", "app/blog/[slug]/page.tsx",
  "app/login/LoginClient.tsx", "app/forgot-password/page.tsx", "app/reset-password/page.tsx",
  "app/verify/[code]/page.tsx", "app/not-found.tsx",
  "components/Navbar.tsx", "components/Footer.tsx", "components/Hero.tsx", "components/TrustSection.tsx",
  "components/WhySection.tsx", "components/BranchesSection.tsx", "components/ContactSection.tsx",
  "components/ProjectsSection.tsx", "components/FeaturedStudentsSection.tsx", "components/CompetitionsSection.tsx",
  "components/ReviewsSection.tsx", "components/PartnersSection.tsx", "components/AccreditationsSection.tsx",
  "components/FAQSection.tsx", "components/LegalPageContent.tsx", "components/TrialForm.tsx",
];
const tokens = {
  "#0B132B": "--navy", "#0B2341": "--navy", "#0B1F3A": "--navy", "#0F172A": "--text",
  "#163560": "--navy-light", "#1E3A5F": "--navy-light", "#1a3a6e": "--navy-light",
  "#F4F7FB": "--bg", "#F8FAFC": "--bg", "#F1F5F9": "--bg-muted", "#F9FAFB": "--bg-muted",
  "#E2E8F0": "--border", "#D7E0EA": "--border", "#EDF1F5": "--border-soft",
  "#334155": "--text-2", "#475569": "--text-3", "#64748B": "--text-3",
  "#94A3B8": "--muted", "#9CA3AF": "--muted", "#CBD5E1": "--muted",
  "#FF8A1F": "--orange-strong", "#F97316": "--orange-strong", "#C2410C": "--orange-strong",
  "#19C6F4": "--cyan-strong", "#38BDF8": "--cyan-strong", "#10B6D3": "--cyan-strong", "#0E7490": "--cyan-strong",
  "#EF4444": "--red-dark", "#F87171": "--red-dark", "#15803D": "--green-dark",
  "#FEE2E2": "--red-soft", "#E7F8EE": "--green-soft",
};
for (const file of files) {
  const original = readFileSync(file, "utf8");
  let source = original;
  for (const [hex, token] of Object.entries(tokens)) source = source.split(hex).join(`var(${token})`);
  source = source.replace(/shadow-\[[^\]\r\n]+\]/g, "shadow-[var(--shadow-card)]")
    .replace(/\bshadow-(?:2xl|xl)\b/g, "shadow-[var(--shadow-md)]")
    .replace(/\brounded-(?:2xl|3xl)\b/g, "rounded-[var(--radius-xl)]")
    .replace(/\btext-rose-(?:400|500|600)\b/g, "text-[var(--red-dark)]")
    .replace(/\bborder-rose-200\b/g, "border-[var(--red)]")
    .replace(/\bbg-rose-(?:50|100)\b/g, "bg-[var(--red-soft)]");
  if (source !== original) { writeFileSync(file, source); console.log(file); }
}
