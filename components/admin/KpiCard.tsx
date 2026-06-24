import Link from "next/link";

interface Props {
  label:     string;
  value:     string | number;
  delta?:    string;
  deltaUp?:  boolean;
  bars?:     number[];
  barColor?: string;
  href?:     string;
  alert?:    boolean;
  sub?:      string;
}

export default function KpiCard({
  label,
  value,
  delta,
  deltaUp,
  bars,
  barColor = "#38BDF8",
  href,
  alert,
  sub,
}: Props) {
  const isAlert = alert && value !== 0 && value !== "0";

  const card = (
    <div className={[
      "ds-card p-4 transition-all duration-150",
      href ? "hover:shadow-[0_4px_16px_rgba(11,31,58,.10)] hover:border-[#CBD5E1] cursor-pointer" : "",
      isAlert ? "!border-[#FECACA] !bg-[#FEE2E2]" : "",
    ].join(" ")}>
      {/* label + delta */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#64748B]">{label}</span>
        {delta !== undefined && (
          <span className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
            deltaUp === false
              ? "bg-[#FEF2F2] text-[#B91C1C]"
              : "bg-[#E7F8EE] text-[#15803D]",
          ].join(" ")}>
            {delta}
          </span>
        )}
      </div>

      {/* value + sparkline */}
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={[
          "font-orbitron text-[26px] font-bold leading-none",
          isAlert ? "text-[#EF4444]" : "text-[#0B1F3A]",
        ].join(" ")}>
          {value}
        </span>
        {bars && bars.length > 0 && (
          <div className="flex items-end gap-[2.5px] h-8 shrink-0">
            {bars.map((b, i) => (
              <span
                key={i}
                style={{ height: `${b}%`, background: isAlert ? "#EF4444" : barColor, opacity: 0.6 + (i / bars.length) * 0.4 }}
                className="w-[3.5px] rounded-[2px] block"
              />
            ))}
          </div>
        )}
      </div>

      {sub && <p className="mt-1.5 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
