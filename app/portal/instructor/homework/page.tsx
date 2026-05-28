import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, listPendingSubmissions } from '@/modules/instructor-portal/queries'
import Link from 'next/link'

export default async function HomeworkReviewPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found. Contact your team leader.
      </div>
    )
  }

  const submissions = await listPendingSubmissions(instructor.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Homework Review</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Submissions waiting for your review</p>
      </div>

      {submissions.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No pending submissions.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              {submissions.length} pending submission{submissions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {submissions.map((s) => (
              <Link
                key={s.submission_id}
                href={`/portal/instructor/homework/${s.submission_id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC] transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">
                    {s.student_name}
                  </p>
                  <p className="truncate text-xs text-[#64748B]">
                    {s.assignment_title}
                    {s.group_name && <> · {s.group_name}</>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[#64748B]">
                    {new Date(s.submitted_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 justify-end">
                    {s.is_late && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                        late
                      </span>
                    )}
                    {s.resubmission_count > 0 && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                        resub {s.resubmission_count}
                      </span>
                    )}
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {s.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
