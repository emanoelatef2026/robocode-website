import Link from "next/link";

type Level = "critical" | "warning" | "info" | "success";

interface Props {
  label:    string;
  count?:   number;
  href?:    string;
  level?:   Level;
  icon?:    React.ReactNode;
  onClose?: () => void;
}

const LEVEL_CLS: Record<Level, string> = {
  critical: "border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]",
  warning:  "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  info:     "border-blue-200 bg-[#EFF6FF] text-[#1D4ED8]",
  success:  "border-[#A7F3D0] bg-[#E7F8EE] text-[#15803D]",
};

const DOT_CLS: Record<Level, string> = {
  critical: "bg-[#DC2626]",
  warning:  "bg-[#D97706]",
  info:     "bg-[#2563EB]",
  success:  "bg-[#16A34A]",
};

export default function InfoBanner({ label, count, href, level = "warning", icon, onClose }: Props) {
  if (count === 0) return null;

  const content = (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] transition ${LEVEL_CLS[level]} ${href ? "hover:brightness-95 cursor-pointer" : ""}`}>
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className={`shrink-0 h-2 w-2 rounded-full ${DOT_CLS[level]}`} />
      )}
      <span className="flex-1 font-medium">{label}</span>
      {count !== undefined && (
        <span className="font-bold tabular-nums">{count}</span>
      )}
      {href && (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 opacity-50">
          <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      )}
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100 transition">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M4.22 4.22a.75.75 0 011.06 0L8 6.94l2.72-2.72a.75.75 0 011.06 1.06L9.06 8l2.72 2.72a.75.75 0 01-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 01-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 010-1.06z" />
          </svg>
        </button>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
