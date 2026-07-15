import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren, getChildNotes } from '@/modules/parents/parent-portal-queries'
import Link from 'next/link'
import ChildSelector from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked from '@/components/portal/parent/NoChildrenLinked'
import EmptyState from '@/components/admin/EmptyState'

interface Props {
  searchParams: Promise<{ child?: string }>
}

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL:         'General',
  ACADEMIC:        'Academic',
  BEHAVIOR:        'Behavior',
  PARENT_FOLLOWUP: 'Follow-up',
}

const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:    { label: 'FYI',       cls: 'bg-[#F1F5F9] text-[#64748B]' },
  MEDIUM: { label: 'Important', cls: 'bg-[#FFFBEB] text-[#B45309]' },
  HIGH:   { label: 'Priority',  cls: 'bg-[#FEF2F2] text-[#B91C1C]' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ParentNotesPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)
  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  // Server-side filtered to SHARED / PARENT_EVALUATION only (canViewerReadNote,
  // the single visibility source of truth used by every portal) — private
  // instructor/TL notes, internal staff notes, and student-only instructions
  // are never fetched here in the first place.
  const notes = await getChildNotes(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Notes from the Academy</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Shared about {selected.student_name}</p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Child switcher */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/notes?child=${id}`}
      />

      {notes.length === 0 ? (
        <EmptyState
          title="No notes shared yet"
          description={`Notes the academy shares with you about ${selected.student_name} will appear here.`}
        />
      ) : (
        <div className="space-y-2.5">
          {notes.map(n => {
            const severity = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.LOW
            return (
              <div key={n.id} className="ds-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                      {CATEGORY_LABEL[n.category] ?? n.category}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${severity.cls}`}>
                      {severity.label}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[#94A3B8]">{formatDate(n.created_at)}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#0B1F3A]">{n.content}</p>
                <p className="mt-1.5 text-[10.5px] text-[#94A3B8]">
                  {n.author_name}{n.schedule_topic ? ` · ${n.schedule_topic}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
