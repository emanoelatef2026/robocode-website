import { KpiCardSkeleton, CardSkeleton } from '@/components/admin/LoadingSkeleton'

export default function InstructorDashboardLoading() {
  return (
    <div>
      {/* Greeting placeholder */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="ds-skeleton h-6 w-52 rounded-lg" />
          <div className="ds-skeleton h-3.5 w-32 rounded" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-3 mt-7 flex items-center gap-[10px]">
        <div className="ds-skeleton h-2.5 w-16 rounded" />
        <div className="h-px flex-1 bg-[#eef1f6]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
        <div className="col-span-2 sm:col-span-1">
          <KpiCardSkeleton />
        </div>
      </div>

      {/* Group cards */}
      <div className="mb-3 mt-7 flex items-center gap-[10px]">
        <div className="ds-skeleton h-2.5 w-28 rounded" />
        <div className="h-px flex-1 bg-[#eef1f6]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  )
}
