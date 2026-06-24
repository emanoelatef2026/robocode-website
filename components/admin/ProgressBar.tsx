interface Props {
  value:      number;  // 0-100
  color?:     string;
  height?:    number;
  className?: string;
  showLabel?: boolean;
}

function healthColor(v: number): string {
  if (v >= 90) return "#10B981";
  if (v >= 75) return "#F59E0B";
  return "#EF4444";
}

export default function ProgressBar({ value, color, height = 6, className = "", showLabel }: Props) {
  const fill = color ?? healthColor(value);
  const pct  = Math.min(100, Math.max(0, value));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        style={{ height }}
        className="flex-1 overflow-hidden rounded-full bg-[#eef1f6]"
      >
        <div
          style={{ width: `${pct}%`, background: fill, height: "100%" }}
          className="rounded-full transition-all duration-500"
        />
      </div>
      {showLabel && (
        <span className="shrink-0 text-[11px] font-bold font-orbitron" style={{ color: fill }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
