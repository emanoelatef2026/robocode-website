import Link from "next/link";

interface Props {
  label:   string;
  value:   string | number;
  fill:    number; // 0–100
  icon:    React.ReactNode;
  iconBg:  string;
  iconFg:  string;
  href?:   string;
}

export default function AcademyKPICard({ label, value, fill, icon, iconBg, iconFg, href }: Props) {
  const card = (
    <div className={[
      "flex flex-col gap-3 rounded-xl border border-[#D7E0EA] bg-white p-4",
      href ? "cursor-pointer transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(11,31,58,.10)]" : "",
    ].join(" ")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-normal leading-none text-[#64748B]">{label}</span>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconBg }}
        >
          <span style={{ color: iconFg }} className="h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        </div>
      </div>

      <p className="text-[26px] font-bold leading-none tracking-[-0.03em] text-[#0B1F3A]">{value}</p>

      <div className="h-1 overflow-hidden rounded-full bg-[#EDF1F5]">
        <div
          className="h-full rounded-full opacity-80"
          style={{ width: `${Math.min(100, Math.max(0, fill))}%`, background: iconFg }}
        />
      </div>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
