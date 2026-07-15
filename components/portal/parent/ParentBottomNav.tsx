"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { BottomNav } from "@/components/shared/layout/BottomNav"
import { PARENT_BOTTOM_NAV, PARENT_BOTTOM_MORE } from "@/modules/parents/navigation"

function NavInner() {
  const searchParams = useSearchParams()
  const child = searchParams.get("child")
  const getHref = (href: string) => (child ? `${href}?child=${child}` : href)

  return <BottomNav items={PARENT_BOTTOM_NAV} moreItems={PARENT_BOTTOM_MORE} getHref={getHref} />
}

export default function ParentBottomNav() {
  return (
    <Suspense fallback={<div className="bottom-nav-safe fixed inset-x-0 bottom-0 z-(--z-bottom-nav) bg-white" style={{ height: "var(--bottom-nav-height)" }} />}>
      <NavInner />
    </Suspense>
  )
}
