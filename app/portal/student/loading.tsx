import { KpiCardSkeleton, CardSkeleton } from '@/components/admin/LoadingSkeleton'

export default function StudentPortalLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}
