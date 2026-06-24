interface Props {
  title:  string;
  sub?:   string;
  action?: React.ReactNode;
  className?: string;
}

export default function SectionTitle({ title, sub, action, className = "" }: Props) {
  return (
    <div className={`flex items-end justify-between gap-3 mb-3 ${className}`}>
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{title}</p>
        {sub && <p className="mt-0.5 text-[11px] text-[#CBD5E1]">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
