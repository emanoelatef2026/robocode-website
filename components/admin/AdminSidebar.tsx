"use client"

import PortalSidebar from "@/components/shared/sidebar/PortalSidebar"
import { filterAdminSections } from "@/modules/admin/navigation"
import type { PortalRole } from "@/components/shared/layout/roles"

interface Props {
  isOpen:      boolean
  onClose:     () => void
  role:        PortalRole
  permissions: string[]
  email?:      string | null
}

export default function AdminSidebar({ isOpen, onClose, role, permissions, email }: Props) {
  const sections = filterAdminSections(role, permissions)

  return (
    <PortalSidebar
      sections={sections}
      role={role}
      name={email}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}
