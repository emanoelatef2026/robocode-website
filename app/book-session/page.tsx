import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import TrialForm from "../../components/TrialForm";

export const metadata: Metadata = {
  title: "Book Free Trial Session | Robocode School",
  description:
    "Book a free trial session at Robocode School. Fill in your details and our team will confirm your booking within 24 hours.",
};

export default function BookSessionPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F7FB] text-[#0B132B]">

      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 -top-50 h-125 w-125 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />

      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-size-[60px_60px]" />

      <Navbar />

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-28 pt-36 lg:pt-44">

        {/* Page header */}
        <div className="mb-12 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
            Free Trial
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#0B132B] md:text-5xl">
            Book a Trial Session
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm font-medium leading-relaxed text-slate-600">
            Fill in the details below and our team will confirm your
            child&apos;s free trial within 24 hours.
          </p>
        </div>

        <TrialForm />

      </section>
    </main>
  );
}
