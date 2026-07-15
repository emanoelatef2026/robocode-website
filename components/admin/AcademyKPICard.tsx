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
      "flex flex-col gap-[7px] rounded-[10px] border border-[#e7ebf1] bg-white p-[10px_11px]",
      href ? "cursor-pointer transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(11,31,58,.10)]" : "",
    ].join(" ")}>
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-semibold text-[#64748B]">{label}</span>
        <div
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px]"
          style={{ background: iconBg }}
        >
          <span style={{ color: iconFg }} className="h-3 w-3 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>
        </div>
      </div>

      <p className="font-orbitron text-[22px] font-bold leading-none text-[#0B1F3A]">{value}</p>

      <div className="h-[3px] overflow-hidden rounded-[3px] bg-[#eef1f6]">
        <div
          className="h-full rounded-[3px] opacity-80"
          style={{ width: `${Math.min(100, Math.max(0, fill))}%`, background: iconFg }}
        />
      </div>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
