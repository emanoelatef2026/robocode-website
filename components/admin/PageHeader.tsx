interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[17px] font-semibold leading-tight text-[#0B1F3A] md:text-xl">{title}</h1>
        {description && (
          <p className="mt-0.5 truncate text-[12px] text-[#64748B] md:text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
