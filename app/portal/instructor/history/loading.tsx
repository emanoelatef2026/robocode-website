import { TableSkeleton } from '@/components/admin/LoadingSkeleton'

export default function HistoryLoading() {
  return (
    <div className="space-y-3 md:space-y-4">
      {/* Filter panel placeholder */}
      <div className="ds-skeleton h-12 w-full rounded-xl" />
      <TableSkeleton rows={8} columns={7} />
    </div>
  )
}
