"use client"

import { BottomNav } from "@/components/shared/layout/BottomNav"
import { TL_BOTTOM_NAV, TL_BOTTOM_MORE } from "@/modules/team-leader/navigation"

export default function TLBottomNav() {
  return <BottomNav items={TL_BOTTOM_NAV} moreItems={TL_BOTTOM_MORE} />
}
