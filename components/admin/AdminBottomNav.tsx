"use client"

import { BottomNav } from "@/components/shared/layout/BottomNav"
import { getAdminBottomNav } from "@/modules/admin/navigation"

interface Props {
  role:        string
  permissions: string[]
}

export default function AdminBottomNav({ role, permissions }: Props) {
  const { items, moreItems } = getAdminBottomNav(role, permissions)
  return <BottomNav items={items} moreItems={moreItems} />
}
