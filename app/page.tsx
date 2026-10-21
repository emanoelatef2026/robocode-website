import { getSupabaseAdmin } from "@/lib/supabase/server";
import Navbar      from "../components/Navbar";
import HomeSections from "../components/HomeSections";
import Footer      from "../components/Footer";

// Re-render on every request so homepage reflects admin changes immediately.
export const dynamic = "force-dynamic";

// Fallback order used when the DB table doesn't exist yet or is unreachable.
const DEFAULT_SECTIONS = [
  "hero",
  "trust",
  "why",
  "programs",
  "learning_journey",
  "projects",
  "featured_students",
  "competitions",
  "branches",
  "reviews",
  "accreditations",
  "partners",
  "faq",
  "contact",  // always render the final CTA — was accidentally omitted
];

export default async function Home() {
  let sectionKeys = DEFAULT_SECTIONS;

  try {
    // Query ALL rows (enabled and disabled) so we can distinguish:
    //   - disabled in DB  → must not render
    //   - not in DB at all → render using DEFAULT_SECTIONS position (unseeded section)
    const { data, error } = await getSupabaseAdmin()
      .from("homepage_sections")
      .select("key, enabled")
      .order("sort_order", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const allDbKeys     = data.map((s: { key: string; enabled: boolean }) => s.key);
      const enabledDbKeys = data
        .filter((s: { key: string; enabled: boolean }) => s.enabled)
        .map((s: { key: string; enabled: boolean }) => s.key);

      // Only append DEFAULT_SECTIONS keys that have never been seeded — not ones
      // that exist in DB but are currently disabled.
      const unseeded = DEFAULT_SECTIONS.filter((k) => !allDbKeys.includes(k));
      sectionKeys = [...enabledDbKeys, ...unseeded];
    }
  } catch {
    // Table not seeded yet or network issue — fall back to default order.
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">

        {/* Background glow — orange primary, very subtle */}

        {/* Decorative navy bloom — bottom right */}

        {/* Subtle grid */}

        <Navbar />
        <HomeSections sections={sectionKeys} />
      </main>

      {/* Footer — outside main so it isn't clipped by overflow-hidden */}
      <Footer />
    </>
  );
}
