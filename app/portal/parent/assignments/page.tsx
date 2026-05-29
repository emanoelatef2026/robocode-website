import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getParentChildren,
  getChildAssignments,
} from '@/modules/parents/parent-portal-queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string; filter?: string }>
}

type FilterKey = 'all' | 'pending' | 'submitted' | 'graded'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded',    label: 'Graded'    },
]

const STATUS_CONFIG: Record<string, { text: string; cls: string }> = {
  pending:                  { text: 'Pending',     cls: 'bg-yellow-100 text-yellow-700' },
  submitted:                { text: 'Submitted',   cls: 'bg-blue-100   text-blue-700'   },
  under_review:             { text: 'In Review',   cls: 'bg-blue-100   text-blue-700'   },
  resubmitted:              { text: 'Resubmitted', cls: 'bg-blue-100   text-blue-700'   },
  graded:                   { text: 'Graded',      cls: 'bg-green-100  text-green-700'  },
  returned:                 { text: 'Returned',    cls: 'bg-red-100    text-red-700'    },
  resubmission_requested:   { text: 'Revision',    cls: 'bg-red-100    text-red-700'    },
}

function getFilterKey(status: string | null): FilterKey {
  if (!status)                                                    return 'pending'
  if (status === 'graded')                                        return 'graded'
  return 'submitted'
}

export default async function ParentAssignmentsPage({ searchParams }: Props) {
  const { child, filter = 'all' } = await searchParams
  const user                      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const all = await getChildAssignments(user.id, selected.student_id)

  const filterKey  = (FILTERS.find(f => f.key === filter)?.key ?? 'all') as FilterKey
  const items = filterKey === 'all'
    ? all
    : all.filter(a => getFilterKey(a.submission_status) === filterKey)

  const childParam = `?child=${selected.student_id}`
  const filterHref = (key: string) => `/portal/parent/assignments${childParam}&filter=${key}`

  const counts: Record<FilterKey, number> = {
    all:       all.length,
    pending:   all.filter(a => getFilterKey(a.submission_status) === 'pending').length,
    submitted: all.filter(a => getFilterKey(a.submission_status) === 'submitted').length,
    graded:    all.filter(a => getFilterKey(a.submission_status) === 'graded').length,
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Assignments</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{selected.student_name}</p>
        </div>
        <Link
          href={`/portal/parent${childParam}`}
          className="text-[13px] text-[#FF8A1F] hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
            className={[
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
              filterKey === f.key
                ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
            ].join(' ')}
          >
            {f.label}
            <span className={[
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              filterKey === f.key ? 'bg-[#FF8A1F] text-white' : 'bg-[#F1F5F9] text-[#64748B]',
            ].join(' ')}>
              {counts[f.key]}
            </span>
          </Link>
        ))}
      </div>

      {/* Assignments list */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">
            {filterKey === 'all' ? 'No assignments found.' : `No ${filterKey} assignments.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const statusKey = a.submission_status ?? 'pending'
            const cfg = STATUS_CONFIG[statusKey] ?? { text: statusKey, cls: 'bg-gray-100 text-gray-600' }

            return (
              <div key={a.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#0B1F3A]">{a.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
                        {cfg.text}
                      </span>
                      {a.is_late && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          Late
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-[12px] text-[#64748B]">
                      {[a.course_title, a.module_title].filter(Boolean).join(' · ')}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-[#94A3B8]">
                      {a.due_at && (
                        <span>
                          Due {new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {a.submission_submitted_at && (
                        <span>
                          Submitted {new Date(a.submission_submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {a.submission_score != null && (
                        <span className="font-semibold text-[#0B1F3A]">
                          Score: {a.submission_score} / {a.max_score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Public feedback only — never internal notes */}
                {a.public_feedback && (
                  <div className="mt-3 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9] px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Instructor Feedback
                    </p>
                    <p className="text-[13px] text-[#64748B] whitespace-pre-wrap">{a.public_feedback}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
