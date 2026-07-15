"use client"

import PortalSidebar from "@/components/shared/sidebar/PortalSidebar"
import { INSTRUCTOR_SECTIONS } from "@/modules/instructor-portal/navigation"

interface Props {
  isOpen:  boolean
  onClose: () => void
  email?:  string | null
}

export default function InstructorSidebar({ isOpen, onClose, email }: Props) {
  return (
    <PortalSidebar
      sections={INSTRUCTOR_SECTIONS}
      role="instructor"
      name={email}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}
