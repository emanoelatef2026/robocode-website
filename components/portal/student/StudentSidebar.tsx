"use client"

import PortalSidebar from "@/components/shared/sidebar/PortalSidebar"
import { STUDENT_SECTIONS } from "@/modules/student-portal/navigation"

interface Props {
  isOpen:        boolean
  onClose:       () => void
  studentName?:  string
  groupName?:    string
  currentLevel?: number
  totalXp?:      number
  xpProgressPct?: number
  xpToNextLevel?: number
}

export default function StudentSidebar({
  isOpen, onClose, studentName, groupName,
  currentLevel = 1, totalXp = 0, xpProgressPct = 0, xpToNextLevel = 500,
}: Props) {
  return (
    <PortalSidebar
      sections={STUDENT_SECTIONS}
      role="student"
      name={studentName}
      subtitle={groupName}
      isOpen={isOpen}
      onClose={onClose}
      footerExtra={
        <div className="mb-3 rounded-[10px] border border-white/8 bg-white/5 px-2.5 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">⭐</span>
              <span className="text-[11px] font-bold text-[#FFB15A]">LV.{currentLevel}</span>
            </div>
            <span className="text-[11px] font-bold text-[#FFB15A]" style={{ fontFamily: "var(--font-orbitron)" }}>
              {totalXp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-sm bg-white/10">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${xpProgressPct}%`,
                background: "linear-gradient(90deg, #FF8A1F, #FFD166, #FF8A1F)",
                backgroundSize: "200%",
                animation: "xpglow 3s ease infinite",
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/45">{xpToNextLevel.toLocaleString()} XP to next level</p>
        </div>
      }
    />
  )
}
