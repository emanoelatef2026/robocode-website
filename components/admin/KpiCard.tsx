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
      "rounded-[10px] border p-[10px_11px] transition-shadow duration-150",
      href ? "cursor-pointer hover:shadow-[0_4px_16px_rgba(11,31,58,.10)]" : "",
      isAlert
        ? "border-[#FECACA] bg-[#FEF2F2]"
        : "border-[#e7ebf1] bg-white",
    ].join(" ")}>

      {/* label */}
      <p className="text-[9.5px] font-semibold text-[#64748B] mb-[5px] truncate">{label}</p>

      {/* value */}
      <p className={[
        "font-orbitron text-[19px] font-bold leading-none",
        isAlert ? "text-[#DC2626]" : "text-[#0B1F3A]",
      ].join(" ")}>
        {value}
      </p>

      {sub && <p className="mt-1 text-[10px] text-[#94A3B8]">{sub}</p>}

      {/* sparkline + delta row */}
      {(bars || delta !== undefined) && (
        <div className="mt-[7px] flex items-end justify-between">
          {/* sparkline */}
          <div className="flex items-end gap-[2px] h-[14px] shrink-0">
            {(bars ?? []).map((b, i, arr) => (
              <span
                key={i}
                style={{
                  height:     `${b}%`,
                  background: isAlert ? "#EF4444" : barColor,
                  opacity:    0.45 + (i / Math.max(arr.length - 1, 1)) * 0.55,
                }}
                className="w-[3px] rounded-[1.5px] block"
              />
            ))}
          </div>

          {/* delta badge */}
          {delta !== undefined && (
            <span className={[
              "text-[8.5px] font-bold rounded-[8px] px-[6px] py-[2px] shrink-0",
              deltaUp === false || isAlert
                ? "bg-[#FEE2E2] text-[#DC2626]"
                : "bg-[#E7F8EE] text-[#15803D]",
            ].join(" ")}>
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
