interface Props {
  rows?:       number;
  columns?:    number;
  height?:     number | string;
  className?:  string;
  cardStyle?:  boolean;
}

function SkeletonBox({ h, w = "w-full", className = "" }: { h: string; w?: string; className?: string }) {
  return <div className={`ds-skeleton ${w} ${h} ${className}`} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="ds-card p-4 space-y-3">
      <SkeletonBox h="h-3" w="w-20" />
      <SkeletonBox h="h-7" w="w-16" />
      <div className="flex items-end gap-0.5 h-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`ds-skeleton flex-1 rounded-[2px]`} style={{ height: `${30 + i * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="ds-card overflow-hidden">
      {/* header */}
      <div className="flex gap-4 px-4 py-3 border-b border-[#e7ebf1] bg-[#F8FAFC]">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBox key={i} h="h-3" w="flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-[#f1f4f8] last:border-none">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBox key={c} h="h-3" w="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`ds-card p-4 space-y-3 ${className}`}>
      <SkeletonBox h="h-4" w="w-32" />
      <SkeletonBox h="h-3" w="w-full" />
      <SkeletonBox h="h-3" w="w-3/4" />
    </div>
  );
}

export default function LoadingSkeleton({ rows = 5, columns = 4, cardStyle }: Props) {
  if (cardStyle) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return <TableSkeleton rows={rows} columns={columns} />;
}
