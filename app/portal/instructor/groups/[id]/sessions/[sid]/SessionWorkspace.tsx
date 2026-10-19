'use client'

import { useId, useState } from 'react'
import type { SessionDetail } from '@/modules/instructor-portal/types'
import AttendanceForm, { type WorkspaceSection } from './AttendanceForm'
import SessionDetailsPanel from './SessionDetailsPanel'

const sections: { id: WorkspaceSection; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'content', label: 'Session content' },
  { id: 'homework', label: 'Homework' },
  { id: 'notes', label: 'Notes & evaluations' },
]

export default function SessionWorkspace({ session, groupId }: { session: SessionDetail; groupId: string }) {
  const [active, setActive] = useState<WorkspaceSection>('attendance')
  const [attendanceBusy, setAttendanceBusy] = useState(false)
  const [panelBusy, setPanelBusy] = useState(false)
  const busy = attendanceBusy || panelBusy
  const [ended, setEnded] = useState(false)
  const id = useId()
  return <div className="space-y-4 pb-4">
    {ended && <p className="rounded-lg bg-(--green-soft) p-3 text-sm font-medium text-(--green-dark)">Session completed. Your attendance has been saved.</p>}
    <div role="tablist" aria-label="Session workspace" className="flex gap-1 overflow-x-auto border-b border-(--border)">
      {sections.map((section, index) => <button key={section.id} id={`${id}-${section.id}`} type="button" role="tab" aria-selected={active === section.id} aria-controls={`${id}-panel`} tabIndex={active === section.id ? 0 : -1} disabled={busy} onClick={() => setActive(section.id)} onKeyDown={event => {
        const target = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1
        if (target < 0 || busy) return
        event.preventDefault()
        setActive(sections[target].id)
        document.getElementById(`${id}-${sections[target].id}`)?.focus()
      }} className={`min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-medium disabled:opacity-50 ${active === section.id ? 'border-(--cyan-strong) text-(--cyan-strong)' : 'border-transparent text-(--text-3) hover:bg-(--bg-muted)'}`}>{section.label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>
      <AttendanceForm sessionId={session.id} groupId={groupId} rows={session.attendance} currentTopic={session.topic} attendanceRevision={session.attendance_revision} sessionStatus={ended ? 'completed' : session.status} activeSection={active} onBusyChange={setAttendanceBusy} onCompleted={() => setEnded(true)} onSectionChange={setActive} externalBusy={panelBusy}>
        <SessionDetailsPanel session={ended ? { ...session, status: 'completed' } : session} groupId={groupId} activeSection={active} busy={attendanceBusy} onBusyChange={setPanelBusy} />
      </AttendanceForm>
    </div>
  </div>
}
