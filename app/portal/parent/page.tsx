import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getParentChildren,
  getChildEnrollment,
  getChildProgressStats,
  getChildAssignments,
} from '@/modules/parents/parent-portal-queries'
import { getChildCertificates } from '@/modules/certificates/queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

function ProgressBar({ value }: { value: number }) {
  const pct   = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      {value == null ? (
        <p className="mt-1 text-sm text-[#94A3B8]">—</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold text-[#0B1F3A]">{Math.round(value)}%</p>
          <ProgressBar value={value} />
        </>
      )}
    </div>
  )
}

function submissionLabel(status: string | null): { text: string; cls: string } {
  if (!status)                return { text: 'Pending',   cls: 'bg-yellow-100 text-yellow-700' }
  if (status === 'graded')    return { text: 'Graded',    cls: 'bg-green-100  text-green-700'  }
  if (status === 'submitted' || status === 'under_review' || status === 'resubmitted')
                              return { text: 'Submitted', cls: 'bg-blue-100   text-blue-700'   }
  if (status === 'returned' || status === 'resubmission_requested')
                              return { text: 'Returned',  cls: 'bg-red-100    text-red-700'    }
  return                             { text: status,      cls: 'bg-gray-100   text-gray-600'   }
}

export default async function ParentDashboardPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#0B1F3A]">No children linked</p>
          <p className="mt-1 text-sm text-[#64748B]">
            Contact your administrator to link your children to this account.
          </p>
        </div>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const [enrollment, progress, assignments, certificates] = await Promise.all([
    getChildEnrollment(user.id, selected.student_id),
    getChildProgressStats(user.id, selected.student_id),
    getChildAssignments(user.id, selected.student_id),
    getChildCertificates(user.id, selected.student_id),
  ])

  const pending   = assignments.filter(a => !a.submission_id)
  const latest    = certificates.slice(0, 2)
  const childHref = (path: string) => `${path}?child=${selected.student_id}`

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">
          {selected.student_name}&apos;s Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          {children.length} {children.length === 1 ? 'child' : 'children'} linked
          {selected.branch_name && ` · ${selected.branch_name}`}
        </p>
      </div>

      {/* Multi-child switcher */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <Link
              key={c.student_id}
              href={`/portal/parent?child=${c.student_id}`}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
                c.student_id === selected.student_id
                  ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
              ].join(' ')}
            >
              <span className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                c.student_id === selected.student_id ? 'bg-[#FF8A1F] text-white' : 'bg-[#E2E8F0] text-[#64748B]',
              ].join(' ')}>
                {c.student_name.charAt(0).toUpperCase()}
              </span>
              {c.student_name}
            </Link>
          ))}
        </div>
      )}

      {/* Enrollment card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Current Enrollment
        </p>
        {!enrollment || (!enrollment.group_name && !enrollment.course_title) ? (
          <p className="text-sm text-[#94A3B8]">Not enrolled in any active group.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Group',      value: enrollment.group_name      },
              { label: 'Course',     value: enrollment.course_title    },
              { label: 'Instructor', value: enrollment.instructor_name },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Attendance"   value={progress?.attendance_pct ?? null} />
        <StatCard label="Assignments"  value={progress?.assignment_pct ?? null} />
        <StatCard label="Portfolio"    value={progress?.portfolio_pct  ?? null} />
        <StatCard label="Overall"      value={progress?.progress_pct   ?? null} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Attendance',   href: childHref('/portal/parent/attendance'),   cls: 'text-green-600  bg-green-50  border-green-100'  },
          { label: 'Assignments',  href: childHref('/portal/parent/assignments'),  cls: 'text-blue-600   bg-blue-50   border-blue-100'   },
          { label: 'Portfolio',    href: childHref('/portal/parent/portfolio'),    cls: 'text-purple-600 bg-purple-50 border-purple-100' },
          { label: 'Certificates', href: childHref('/portal/parent/certificates'), cls: 'text-[#FF8A1F]  bg-[#FFF7ED] border-orange-100' },
        ].map(({ label, href, cls }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center rounded-xl border px-3 py-4 text-sm font-semibold transition hover:opacity-80 ${cls}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Pending assignments */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              Pending Assignments
              {pending.length > 0 && (
                <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {pending.length}
                </span>
              )}
            </p>
            <Link href={childHref('/portal/parent/assignments')} className="text-[12px] text-[#FF8A1F] hover:underline">
              View all
            </Link>
          </div>

          {pending.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No pending assignments.</p>
          ) : (
            <div className="space-y-2">
              {pending.slice(0, 4).map(a => {
                const badge = submissionLabel(a.submission_status)
                return (
                  <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0B1F3A]">{a.title}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {a.course_title ?? ''}
                        {a.due_at && ` · Due ${new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Latest certificates */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">Latest Certificates</p>
            <Link href={childHref('/portal/parent/certificates')} className="text-[12px] text-[#FF8A1F] hover:underline">
              View all
            </Link>
          </div>

          {latest.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No certificates yet.</p>
          ) : (
            <div className="space-y-2">
              {latest.map(c => (
                <div key={c.id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
                  <p className="text-sm font-medium text-[#0B1F3A]">{c.title}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {new Date(c.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {c.course_title && ` · ${c.course_title}`}
                  </p>
                  {c.status === 'active' && (
                    <a
                      href={`/verify/${c.certificate_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[11px] text-[#FF8A1F] hover:underline"
                    >
                      Verify →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
