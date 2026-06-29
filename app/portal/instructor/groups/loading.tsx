import { CardSkeleton } from '@/components/admin/LoadingSkeleton'

export default function InstructorGroupsLoading() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} className="h-44" />
      ))}
    </div>
  )
}
