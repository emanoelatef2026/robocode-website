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
  "reviews",
  "accreditations",
  "partners",
  "faq",
];

export default async function Home() {
  let sectionKeys = DEFAULT_SECTIONS;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("homepage_sections")
      .select("key")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      sectionKeys = data.map((s: { key: string }) => s.key);
    }
  } catch {
    // Table not seeded yet or network issue — fall back to default order.
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A]">

        {/* Background glow — orange primary, very subtle */}
        <div className="pointer-events-none absolute left-1/2 -top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-[#FF8A1F]/8 blur-3xl md:-top-50 md:h-125 md:w-125" />

        {/* Decorative navy bloom — bottom right */}
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#0B1F3A]/5 blur-[100px]" />

        {/* Subtle grid */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-size-[60px_60px]" />

        <Navbar />
        <HomeSections sections={sectionKeys} />
      </main>

      {/* Footer — outside main so it isn't clipped by overflow-hidden */}
      <Footer />
    </>
  );
}
