"use client"

import { BottomNav } from "@/components/shared/layout/BottomNav"
import { INSTRUCTOR_BOTTOM_NAV, INSTRUCTOR_BOTTOM_MORE } from "@/modules/instructor-portal/navigation"

export default function InstructorBottomNav() {
  return <BottomNav items={INSTRUCTOR_BOTTOM_NAV} moreItems={INSTRUCTOR_BOTTOM_MORE} />
}
