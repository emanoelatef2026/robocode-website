import Link from 'next/link'

export default function StudentPortalNotFound() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <p className="text-4xl font-bold text-[#FF8A1F]">404</p>
      <p className="text-sm font-semibold text-[#0B1F3A]">This page couldn&apos;t be found.</p>
      <p className="text-xs text-[#64748B]">It may have been moved, or the link might be wrong.</p>
      <Link href="/portal/student" className="mt-2 text-xs font-medium text-[#FF8A1F] hover:underline">
        ← Back to Dashboard
      </Link>
    </div>
  )
}
