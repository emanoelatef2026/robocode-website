"use client"

import PortalSidebar from "@/components/shared/sidebar/PortalSidebar"
import { TL_SECTIONS } from "@/modules/team-leader/navigation"

interface Props {
  isOpen:  boolean
  onClose: () => void
  email?:  string | null
}

export default function TLSidebar({ isOpen, onClose, email }: Props) {
  return (
    <PortalSidebar
      sections={TL_SECTIONS}
      role="team_leader"
      name={email}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}
