"use client"

import StudentSidebar from "./StudentSidebar"
import StudentBottomNav from "./StudentBottomNav"
import { AppLayout } from "@/components/shared/layout/AppLayout"
import TopHeader from "@/components/shared/layout/TopHeader"
import { TopbarActionProvider } from "@/components/shared/layout/TopbarActionContext"
import NotificationBell from "@/components/portal/shared/NotificationBell"
import { STUDENT_SECTIONS } from "@/modules/student-portal/navigation"

interface Props {
  children:             React.ReactNode
  studentName?:         string
  groupName?:           string
  currentStreak?:       number
  groupRank?:           number | null
  currentLevel?:        number
  totalXp?:             number
  xpProgressPct?:       number
  xpToNextLevel?:       number
  unreadNotifications?: number
}

export default function StudentShell({
  children,
  studentName,
  groupName,
  currentStreak = 0,
  groupRank = null,
  currentLevel = 1,
  totalXp = 0,
  xpProgressPct = 0,
  xpToNextLevel = 500,
  unreadNotifications = 0,
}: Props) {
  const firstName = studentName?.split(" ")[0] ?? "Student"

  return (
    <TopbarActionProvider>
      <AppLayout
        renderSidebar={({ isOpen, onClose }) => (
          <StudentSidebar
            isOpen={isOpen}
            onClose={onClose}
            studentName={studentName}
            groupName={groupName}
            currentLevel={currentLevel}
            totalXp={totalXp}
            xpProgressPct={xpProgressPct}
            xpToNextLevel={xpToNextLevel}
          />
        )}
        renderHeader={({ onMenuClick }) => (
          <TopHeader
            onMenuClick={onMenuClick}
            role="student"
            sections={STUDENT_SECTIONS}
            centerSlot={
              <div className="hidden md:block">
                <p className="text-[17px] font-extrabold leading-tight text-[#0B1F3A]">Hey, {firstName} 👋</p>
                <p className="mt-0.5 text-[11.5px] text-[#64748B]" suppressHydrationWarning>
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {groupName ? ` · ${groupName}` : ""}
                </p>
              </div>
            }
            quickActions={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-[7px] rounded-[10px] border border-[#f6e3c4] bg-[#FFF7E6] px-3 py-[7px]">
                  <span className="text-[15px]" aria-hidden>🔥</span>
                  <div>
                    <div className="text-[14px] font-bold leading-none text-[#B45309]" style={{ fontFamily: "var(--font-orbitron)" }}>
                      {currentStreak}
                    </div>
                    <div className="text-[9px] font-semibold tracking-[.05em] text-[#B45309]">DAY STREAK</div>
                  </div>
                </div>

                {groupRank != null && (
                  <div className="hidden items-center gap-[7px] rounded-[10px] bg-[#0B1F3A] px-3 py-[7px] md:flex">
                    <span className="text-[14px]" aria-hidden>🏆</span>
                    <div>
                      <div className="text-[14px] font-bold leading-none text-[#FFB15A]" style={{ fontFamily: "var(--font-orbitron)" }}>
                        #{groupRank}
                      </div>
                      <div className="text-[9px] font-semibold text-white/50">IN GROUP</div>
                    </div>
                  </div>
                )}
              </div>
            }
            notificationSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
        )}
        bottomNav={<StudentBottomNav />}
      >
        {children}
      </AppLayout>
    </TopbarActionProvider>
  )
}
