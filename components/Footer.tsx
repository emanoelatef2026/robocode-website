import Image from "next/image";
import Link from "next/link";

const PROGRAM_LINKS = [
  { label: "AI & Machine Learning", href: "/#programs" },
  { label: "Robotics",              href: "/#programs" },
  { label: "Game Development",      href: "/#programs" },
  { label: "Web & App Dev",         href: "/#programs" },
];

const COMPANY_LINKS = [
  { label: "About Us",     href: "#" },
  { label: "Our Branches", href: "/#branches" },
  { label: "Competitions", href: "/#competitions" },
  { label: "Contact Us",   href: "#" },
];

const SOCIALS = [
  {
    label: "Facebook",
    short: "Fb",
    href: "https://www.facebook.com/RobocodeSchool",
    accent: "cyan" as const,
  },
  {
    label: "Instagram",
    short: "In",
    href: "https://www.instagram.com/robocode_school/",
    accent: "cyan" as const,
  },
  {
    label: "LinkedIn",
    short: "Li",
    href: "https://www.linkedin.com/company/robocode-school/?viewAsMember=true",
    accent: "cyan" as const,
  },
  {
    label: "TikTok",
    short: "Tk",
    href: "https://www.tiktok.com/@robocode_school",
    accent: "orange" as const,
  },
];

export default function Footer() {
  return (
    <footer id="branches" className="relative z-10 bg-[#0B132B] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-20">

        {/* Top grid */}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/logo.png"
              alt="Robocode Logo"
              width={140}
              height={60}
              className="h-auto w-27.5 brightness-0 invert"
            />

            <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/60">
              We don&apos;t teach kids to use technology — we teach them to
              build it. Empowering the next generation of innovators,
              engineers, and creators.
            </p>

            <div className="mt-8 flex gap-3">
              {SOCIALS.map(({ label, short, href, accent }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-[10px] font-semibold text-white/40 transition duration-200",
                    accent === "orange"
                      ? "hover:border-[#F97316] hover:text-[#F97316]"
                      : "hover:border-[#19C6F4] hover:text-[#19C6F4]",
                  ].join(" ")}
                >
                  {short}
                </a>
              ))}
            </div>
          </div>

          {/* Programs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Programs
            </p>
            <ul className="mt-5 space-y-3">
              {PROGRAM_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-white/65 transition duration-200 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Company
            </p>
            <ul className="mt-5 space-y-3">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-white/65 transition duration-200 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* CTA banner */}
        <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/4 px-10 py-10 md:flex-row">
          <div className="border-l-2 border-[#F97316]/40 pl-5">
            <h3 className="text-xl font-bold md:text-2xl">
              Ready to start your child&apos;s tech journey?
            </h3>
            <p className="mt-2 text-sm text-white/55">
              Book a free trial session at your nearest Robocode branch.
            </p>
          </div>
          <Link
            href="/book-session"
            className="shrink-0 rounded-full bg-[#19C6F4] px-8 py-3 text-sm font-semibold text-white shadow-[0_0_22px_rgba(25,198,244,0.35)] transition duration-200 hover:brightness-110 hover:shadow-[0_0_32px_rgba(25,198,244,0.55)]"
          >
            Book Free Trial
          </Link>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/[0.07] pt-6">
          <div className="flex flex-col items-center justify-between gap-2 text-center text-xs text-white/35 md:flex-row">
            <span>© 2026 Robocode School. All rights reserved.</span>
            <span>Empowering future builders, one line of code at a time.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
