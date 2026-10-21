import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import TrialForm from "../../components/TrialForm";
import Footer from "@/components/Footer";
import PublicPageHeading from "@/components/public-site/PublicPageHeading";

export const metadata: Metadata = {
  title: "Book Free Trial Session | Robocode School",
  description:
    "Book a free trial session at Robocode School. Fill in your details and our team will confirm your booking within 24 hours.",
};

export default function BookSessionPage() {
  return (
    <><main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--navy)]">

      {/* Background glow */}

      {/* Grid texture */}

      <Navbar />

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-28 pt-36 lg:pt-44">

        {/* Page header */}
        <PublicPageHeading kind="booking" />

        <TrialForm />

      </section>
    </main><Footer /></>
  );
}
