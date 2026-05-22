import Reveal from "./Reveal";

export default function WhySection() {
  return (
    <Reveal>
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-500">
            WHY ROBOCODE
          </p>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl md:text-6xl">
            More Than Coding Courses
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base text-slate-700 md:mt-6 md:text-lg">
            We help students build real technology skills,
            confidence, creativity, leadership,
            and future-ready thinking.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:mt-20 md:grid-cols-2 md:gap-8">

          <div className="group rounded-2xl border border-white/50 bg-white/70 p-7 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl md:rounded-3xl md:p-10 md:hover:-translate-y-2">
            <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-cyan-500 text-2xl text-white md:mb-6 md:h-16 md:w-16 md:rounded-2xl md:text-3xl">
              🚀
            </div>
            <h3 className="text-xl font-bold md:text-3xl">Build Real Projects</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-700 md:mt-4 md:text-lg">
              Students create games, robots, AI tools,
              websites, and real applications.
            </p>
          </div>

          <div className="group rounded-2xl border border-white/50 bg-white/70 p-7 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl md:rounded-3xl md:p-10 md:hover:-translate-y-2">
            <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-cyan-500 text-2xl text-white md:mb-6 md:h-16 md:w-16 md:rounded-2xl md:text-3xl">
              🤖
            </div>
            <h3 className="text-xl font-bold md:text-3xl">Learn AI &amp; Future Skills</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-700 md:mt-4 md:text-lg">
              Students explore AI, robotics,
              automation, and future technologies.
            </p>
          </div>

          <div className="group rounded-2xl border border-white/50 bg-white/70 p-7 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl md:rounded-3xl md:p-10 md:hover:-translate-y-2">
            <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-cyan-500 text-2xl text-white md:mb-6 md:h-16 md:w-16 md:rounded-2xl md:text-3xl">
              🧠
            </div>
            <h3 className="text-xl font-bold md:text-3xl">Develop Problem Solving</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-700 md:mt-4 md:text-lg">
              Students improve critical thinking,
              teamwork, and presentation skills.
            </p>
          </div>

          <div className="group rounded-2xl border border-white/50 bg-white/70 p-7 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(249,115,22,0.13)] md:rounded-3xl md:p-10 md:hover:-translate-y-2">
            <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-[#F97316] text-2xl text-white md:mb-6 md:h-16 md:w-16 md:rounded-2xl md:text-3xl">
              🏆
            </div>
            <h3 className="text-xl font-bold md:text-3xl">Competitions &amp; Innovation</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-700 md:mt-4 md:text-lg">
              Students participate in robotics competitions,
              hackathons, and innovation challenges.
            </p>
          </div>

        </div>

      </section>
    </Reveal>
  );
}
