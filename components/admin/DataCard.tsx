import Link from "next/link";

interface Props {
  children:   React.ReactNode;
  className?: string;
  href?:      string;
  noPad?:     boolean;
}

export default function DataCard({ children, className = "", href, noPad }: Props) {
  const base = `ds-card ${noPad ? "" : "p-3.5 sm:p-4 md:p-5"} ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${base} block transition-all duration-150 hover:shadow-[0_4px_16px_rgba(11,31,58,.10)] hover:border-[#CBD5E1]`}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}

interface HeaderProps {
  title:   string;
  sub?:    string;
  action?: React.ReactNode;
}

export function DataCardHeader({ title, sub, action }: HeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-[13.5px] font-bold text-[#0B1F3A]">{title}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-[#64748B]">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
