import Reveal from "./Reveal";

export default function TrustSection() {
  return (
    <Reveal>

      <section className="relative z-10 mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-4">

        <div className="rounded-3xl border border-white/40 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-2">
          <p className="text-sm font-semibold text-slate-600">
            Students
          </p>

          <h2 className="mt-3 text-5xl font-bold text-cyan-500">
            3000+
          </h2>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-2">
          <p className="text-sm font-semibold text-slate-600">
            Projects Built
          </p>

          <h2 className="mt-3 text-5xl font-bold text-cyan-500">
            1200+
          </h2>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-2 hover:shadow-[0_8px_32px_rgba(249,115,22,0.15)]">
          <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-3xl bg-[#F97316]/50" />
          <p className="text-sm font-semibold text-slate-600">
            Competitions
          </p>
          <h2 className="mt-3 text-5xl font-bold text-[#F97316]">
            25+
          </h2>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-2">
          <p className="text-sm font-semibold text-slate-600">
            Years Experience
          </p>

          <h2 className="mt-3 text-5xl font-bold text-cyan-500">
            8+
          </h2>
        </div>

      </section>

    </Reveal>
  );
}