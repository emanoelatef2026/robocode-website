import { TableSkeleton } from '@/components/admin/LoadingSkeleton'

export default function HomeworkLoading() {
  return (
    <div className="space-y-6">
      {/* Filter row placeholder */}
      <div className="flex gap-3">
        <div className="ds-skeleton h-9 w-48 rounded-xl" />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  )
}
