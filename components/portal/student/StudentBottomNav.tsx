"use client"

import { BottomNav } from "@/components/shared/layout/BottomNav"
import { STUDENT_BOTTOM_NAV, STUDENT_BOTTOM_MORE } from "@/modules/student-portal/navigation"

export default function StudentBottomNav() {
  return <BottomNav items={STUDENT_BOTTOM_NAV} moreItems={STUDENT_BOTTOM_MORE} />
}
