"use client";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Reveal from "../components/Reveal";
import TrustSection from "../components/TrustSection";
import WhySection from "../components/WhySection";
import ProgramsSection from "../components/ProgramsSection";
import CompetitionsSection from "../components/CompetitionsSection";
import ProjectsSection from "../components/ProjectsSection";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#F4F7FB] text-[#0B132B]">

        {/* Background glow — cyan primary */}
        <div className="pointer-events-none absolute left-1/2 -top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/25 blur-3xl md:-top-50 md:h-125 md:w-125" />

        {/* Decorative orange bloom — bottom right, very subtle */}
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#F97316]/8 blur-[100px]" />

        {/* Subtle grid */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-size-[60px_60px]" />

        <Navbar />
        <Hero />
        <TrustSection />
        <WhySection />
        <ProgramsSection />

        {/* LEARNING JOURNEY */}
        <Reveal>
          <section id="learning-journey" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
                Learning Journey
              </p>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl lg:text-6xl">
                A Complete Future Tech Roadmap
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-base text-slate-700 md:mt-6 md:text-lg">
                Students progress through a structured learning journey
                based on age, skills, creativity, and innovation.
              </p>
            </div>

            {/* Timeline */}
            <div className="relative mt-14 md:mt-24">

              {/* Center line */}
              <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 rounded-full bg-cyan-200/70 md:block" />

              <div className="space-y-8 md:space-y-16">

                {/* Age 6–8 */}
                <div className="relative grid items-center gap-5 md:grid-cols-2 md:gap-10">
                  <div className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-xl md:rounded-3xl md:p-10">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#19C6F4]">
                      Ages 6–8
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">Explorer</h3>
                    <p className="mt-3 text-base text-slate-700 md:mt-4 md:text-lg">
                      Logic building, Scratch programming, LEGO robotics,
                      creativity, and problem solving.
                    </p>
                  </div>
                  <div className="hidden md:flex justify-center">
                    <div className="h-8 w-8 rounded-full bg-[#19C6F4] shadow-[0_0_28px_rgba(25,198,244,0.55)]" />
                  </div>
                </div>

                {/* Age 9–11 */}
                <div className="relative grid items-center gap-5 md:grid-cols-2 md:gap-10">
                  <div className="hidden md:flex justify-center">
                    <div className="h-8 w-8 rounded-full bg-[#F97316] shadow-[0_0_28px_rgba(249,115,22,0.45)]" />
                  </div>
                  <div className="rounded-2xl border-l-2 border-[#F97316]/20 bg-white/70 p-6 shadow-xl backdrop-blur-xl md:rounded-3xl md:p-10">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#F97316]">
                      Ages 9–11
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">Creator</h3>
                    <p className="mt-3 text-base text-slate-700 md:mt-4 md:text-lg">
                      Game development, Roblox, Minecraft, animation,
                      robotics, and digital creativity.
                    </p>
                  </div>
                </div>

                {/* Age 12–14 */}
                <div className="relative grid items-center gap-5 md:grid-cols-2 md:gap-10">
                  <div className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-xl md:rounded-3xl md:p-10">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#19C6F4]">
                      Ages 12–14
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">Developer</h3>
                    <p className="mt-3 text-base text-slate-700 md:mt-4 md:text-lg">
                      Python, web development, Arduino, AI foundations,
                      and real-world coding projects.
                    </p>
                  </div>
                  <div className="hidden md:flex justify-center">
                    <div className="h-8 w-8 rounded-full bg-[#19C6F4] shadow-[0_0_28px_rgba(25,198,244,0.55)]" />
                  </div>
                </div>

                {/* Age 15–17 */}
                <div className="relative grid items-center gap-5 md:grid-cols-2 md:gap-10">
                  <div className="hidden md:flex justify-center">
                    <div className="h-8 w-8 rounded-full bg-[#F97316] shadow-[0_0_28px_rgba(249,115,22,0.45)]" />
                  </div>
                  <div className="rounded-2xl border-l-2 border-[#F97316]/20 bg-white/70 p-6 shadow-xl backdrop-blur-xl md:rounded-3xl md:p-10">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#F97316]">
                      Ages 15–17
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">Innovator</h3>
                    <p className="mt-3 text-base text-slate-700 md:mt-4 md:text-lg">
                      AI automation, startups, advanced programming,
                      real applications, and innovation projects.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </Reveal>

        {/* STUDENT PROJECTS */}
        <Reveal>
          <ProjectsSection />
        </Reveal>

        {/* COMPETITIONS */}
        <CompetitionsSection />

      </main>

      {/* FOOTER — outside main so it isn't clipped by overflow-hidden */}
      <Footer />
    </>
  );
}
