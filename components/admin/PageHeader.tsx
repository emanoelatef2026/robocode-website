interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}

export default function PageHeader({ title, description, action, badge }: Props) {
  return (
    <div className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:mb-6 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-extrabold leading-tight text-[#0B1F3A] tracking-tight">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {description && (
          <p className="mt-1 text-[12px] text-[#64748B] leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{action}</div>}
    </div>
  );
}
