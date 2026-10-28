'use client'

import { useId, useState } from 'react'
import type { SessionDetail } from '@/modules/instructor-portal/types'
import AttendanceForm, { type WorkspaceSection } from './AttendanceForm'
import SessionDetailsPanel from './SessionDetailsPanel'
import styles from './SessionWorkspace.module.css'
import SessionIcon from './SessionIcon'

const sections: { id: WorkspaceSection; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'content', label: 'Session content' },
  { id: 'homework', label: 'Homework' },
  { id: 'notes', label: 'Notes & evaluations' },
]

export default function SessionWorkspace({ session, groupId, isLead = true, canPropose = false }: { session: SessionDetail; groupId: string; isLead?: boolean; canPropose?: boolean }) {
  const [active, setActive] = useState<WorkspaceSection>('attendance')
  const [attendanceBusy, setAttendanceBusy] = useState(false)
  const [panelBusy, setPanelBusy] = useState(false)
  const busy = attendanceBusy || panelBusy
  const [ended, setEnded] = useState(false)
  const id = useId()
  const navigation = <div role="tablist" aria-label="Session workspace" className={styles.tabs}>
      {sections.map((section, index) => <button key={section.id} id={`${id}-${section.id}`} type="button" role="tab" aria-selected={active === section.id} aria-controls={`${id}-panel`} tabIndex={active === section.id ? 0 : -1} disabled={busy} onClick={() => setActive(section.id)} onKeyDown={event => {
        const target = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1
        if (target < 0 || busy) return
        event.preventDefault()
        setActive(sections[target].id)
        document.getElementById(`${id}-${sections[target].id}`)?.focus()
      }} className={styles.tab}><SessionIcon name={section.id === 'content' ? 'content' : section.id === 'homework' ? 'homework' : section.id === 'notes' ? 'notes' : 'attendance'} />{section.label}</button>)}
    </div>
  return <div className="space-y-3 pb-4">
    {ended && <p className="rounded-lg bg-(--green-soft) p-3 text-sm font-medium text-(--green-dark)">Session completed. Your attendance has been saved.</p>}
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>
      <AttendanceForm isLead={isLead} canPropose={canPropose} navigation={navigation} sessionId={session.id} groupId={groupId} rows={session.attendance} currentTopic={session.topic} attendanceRevision={session.attendance_revision} sessionStatus={ended ? 'completed' : session.status} activeSection={active} onBusyChange={setAttendanceBusy} onCompleted={() => setEnded(true)} onSectionChange={setActive} externalBusy={panelBusy}>
        <SessionDetailsPanel reviewMode={!isLead && canPropose} readOnly={!isLead && !canPropose} session={ended ? { ...session, status: 'completed' } : session} groupId={groupId} activeSection={active} busy={attendanceBusy} onBusyChange={setPanelBusy} />
      </AttendanceForm>
    </div>
  </div>
}
