import Reveal from "./Reveal";

export default function TrustSection() {
  return (
    <Reveal>
      <section className="relative z-10 mx-auto mt-6 grid max-w-7xl grid-cols-2 gap-4 px-6 pb-16 md:mt-10 md:grid-cols-4 md:gap-6 md:pb-24">

        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <p className="text-xs font-semibold text-slate-600 md:text-sm">Years Experience</p>
          <h2 className="mt-2 text-4xl font-bold text-cyan-500 md:mt-3 md:text-5xl">4+</h2>
        </div>

        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <p className="text-xs font-semibold text-slate-600 md:text-sm">Students</p>
          <h2 className="mt-2 text-4xl font-bold text-cyan-500 md:mt-3 md:text-5xl">8000+</h2>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(249,115,22,0.15)] md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-2xl bg-[#F97316]/50 md:rounded-l-3xl" />
          <p className="text-xs font-semibold text-slate-600 md:text-sm">Happy Parents</p>
          <h2 className="mt-2 text-4xl font-bold text-[#F97316] md:mt-3 md:text-5xl">16000+</h2>
        </div>

        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <p className="text-xs font-semibold text-slate-600 md:text-sm">Average Rating</p>
          <h2 className="mt-2 text-4xl font-bold text-cyan-500 md:mt-3 md:text-5xl">4.9<span className="text-2xl font-semibold text-slate-400 md:text-3xl">/5</span></h2>
        </div>

      </section>
    </Reveal>
  );
}
