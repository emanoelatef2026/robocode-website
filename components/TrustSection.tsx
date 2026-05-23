import Reveal from "./Reveal";

export default function TrustSection() {
  return (
    <Reveal>
      <section className="relative z-10 mx-auto mt-6 grid max-w-7xl grid-cols-2 gap-4 px-6 pb-16 md:mt-10 md:grid-cols-4 md:gap-6 md:pb-24">

        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <h2 className="text-4xl font-bold text-cyan-500 md:text-5xl">4+</h2>
          <p className="mt-2 text-xs font-semibold text-slate-500 md:text-sm">Years Experience</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <h2 className="text-4xl font-bold text-cyan-500 md:text-5xl">8000+</h2>
          <p className="mt-2 text-xs font-semibold text-slate-500 md:text-sm">Students</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(249,115,22,0.15)] md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <h2 className="text-4xl font-bold text-[#F97316] md:text-5xl">16000+</h2>
          <p className="mt-2 text-xs font-semibold text-slate-500 md:text-sm">Happy Parents</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2">
          <h2 className="text-4xl font-bold text-cyan-500 md:text-5xl">4.9<span className="text-2xl font-semibold text-slate-400 md:text-3xl">/5</span></h2>
          <p className="mt-2 text-xs font-semibold text-slate-500 md:text-sm">Average Rating</p>
        </div>

      </section>
    </Reveal>
  );
}
