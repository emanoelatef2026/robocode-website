import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getStudentProfileForInstructor } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NoteForm from './NoteForm'
import DeleteNoteButton from './DeleteNoteButton'

interface Props { params: Promise<{ id: string; studentId: string }> }

export default async function StudentProfilePage({ params }: Props) {
  const user                = await requirePortalRole('instructor')
  const { id, studentId }   = await params
  const instructor          = await getInstructorByUserId(user.id)

  if (!instructor) notFound()

  const profile = await getStudentProfileForInstructor(
    studentId,
    id,
    instructor.id,
    user.id
  )
  if (!profile) notFound()

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
  const attendancePct = profile.attendance_total > 0
    ? Math.round((profile.attendance_present / profile.attendance_total) * 100)
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link href={`/portal/instructor/groups/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← {profile.group_name}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#0B1F3A]">{name}</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">{profile.email}</p>
      </div>

      {/* Attendance summary */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-sm font-semibold text-[#0B1F3A]">Attendance</p>
        {profile.attendance_total === 0 ? (
          <p className="mt-2 text-sm text-[#94A3B8]">No sessions recorded yet.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[
                { label: 'Total',   value: profile.attendance_total,   color: 'text-[#0B1F3A]' },
                { label: 'Present', value: profile.attendance_present, color: 'text-green-600' },
                { label: 'Absent',  value: profile.attendance_absent,  color: 'text-red-600' },
                { label: 'Late',    value: profile.attendance_late,    color: 'text-yellow-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-center">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-[#94A3B8]">{label}</p>
                </div>
              ))}
            </div>
            {attendancePct !== null && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Attendance rate</span>
                  <span>{attendancePct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className={`h-full rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : attendancePct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${attendancePct}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Instructor Notes — NEVER visible to students or parents */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">My Notes</p>
          <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-medium text-[#FF8A1F]">
            Instructor only
          </span>
        </div>

        {/* Add note form */}
        <NoteForm studentId={studentId} groupId={id} />

        {/* Existing notes */}
        {profile.notes.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {profile.notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 whitespace-pre-wrap text-sm text-[#0B1F3A]">{n.content}</p>
                  <DeleteNoteButton noteId={n.id} studentId={studentId} groupId={id} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-[#94A3B8]">
                  <span>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {n.schedule_topic && <span>· {n.schedule_topic}</span>}
                  {n.is_private && <span>· private</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
