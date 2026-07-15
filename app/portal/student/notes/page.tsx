import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentNotes } from '@/modules/student-notes/queries'
import EmptyState from '@/components/admin/EmptyState'

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL:         'General',
  ACADEMIC:        'Academic',
  BEHAVIOR:        'Behavior',
  PARENT_FOLLOWUP: 'Follow-up',
}

const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:    { label: 'FYI',        cls: 'bg-[#F1F5F9] text-[#64748B]' },
  MEDIUM: { label: 'Important',  cls: 'bg-[#FFFBEB] text-[#B45309]' },
  HIGH:   { label: 'Priority',   cls: 'bg-[#FEF2F2] text-[#B91C1C]' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function StudentNotesPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const notes = studentId
    ? await getStudentNotes(studentId, { userId: user.id, kind: 'student' })
    : []

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Notes & Instructions</h1>
        <p className="mt-0.5 text-[12.5px] text-[#64748B]">Notes and instructions your instructor has shared with you.</p>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Notes and instructions shared by your instructor will appear here."
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
