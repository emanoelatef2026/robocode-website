import Reveal from "./Reveal";

export default function WhySection() {
  return (
    <Reveal>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32">

        <div className="text-center">

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-500">
            WHY ROBOCODE
          </p>

          <h2 className="mt-4 text-4xl font-bold md:text-6xl">
            More Than Coding Courses
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-700">
            We help students build real technology skills,
            confidence, creativity, leadership,
            and future-ready thinking.
          </p>

        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-2">

          <div className="group rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">

            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-3xl text-white">
              🚀
            </div>

            <h3 className="text-3xl font-bold">
              Build Real Projects
            </h3>

            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Students create games, robots, AI tools,
              websites, and real applications.
            </p>

          </div>

          <div className="group rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">

            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-3xl text-white">
              🤖
            </div>

            <h3 className="text-3xl font-bold">
              Learn AI & Future Skills
            </h3>

            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Students explore AI, robotics,
              automation, and future technologies.
            </p>

          </div>

          <div className="group rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">

            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-3xl text-white">
              🧠
            </div>

            <h3 className="text-3xl font-bold">
              Develop Problem Solving
            </h3>

            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Students improve critical thinking,
              teamwork, and presentation skills.
            </p>

          </div>

          <div className="group rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(249,115,22,0.13)]">

            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F97316] text-3xl text-white">
              🏆
            </div>

            <h3 className="text-3xl font-bold">
              Competitions & Innovation
            </h3>

            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Students participate in robotics competitions,
              hackathons, and innovation challenges.
            </p>

          </div>

        </div>

      </section>

    </Reveal>
  );
}