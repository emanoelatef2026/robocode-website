import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, searchStudentsForInstructor } from '@/modules/instructor-portal/queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function StudentSearchPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const sp         = await searchParams
  const query      = sp.q?.trim() ?? ''
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found.
      </div>
    )
  }

  const results = query ? await searchStudentsForInstructor(instructor.id, query) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/portal/instructor" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#0B1F3A]">Student Search</h1>
        {query && (
          <p className="mt-0.5 text-sm text-[#64748B]">
            Results for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Search form (for re-searching without leaving page) */}
      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          autoFocus
          className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/15"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] transition"
        >
          Search
        </button>
      </form>

      {/* Results */}
      {!query ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          Enter a name or email to search.
        </div>
      ) : results.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No students found for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {results.map((s) => {
              const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
              return (
                <Link
                  key={`${s.student_id}:${s.group_id}`}
                  href={`/portal/instructor/groups/${s.group_id}/students/${s.student_id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[#F8FAFC]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-sm font-semibold text-[#3B82F6]">
                    {name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#0B1F3A]">{name}</p>
                    <p className="text-xs text-[#94A3B8]">{s.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[#64748B]">{s.group_name}</p>
                    <p className="text-xs text-[#FF8A1F]">View profile →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
