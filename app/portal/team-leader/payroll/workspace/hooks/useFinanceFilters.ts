"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { getMonthRange, getPreset } from "../utils"

interface Options {
  initialDateFrom: string
  initialDateTo:   string
  initialBranchId: string
}

export function useFinanceFilters({
  initialDateFrom,
  initialDateTo,
  initialBranchId,
}: Options) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchP    = useSearchParams()
  const [, startT] = useTransition()

  const [dateFrom,   setDateFrom]   = useState(initialDateFrom)
  const [dateTo,     setDateTo]     = useState(initialDateTo)
  const [branchId,   setBranchId]   = useState(initialBranchId)
  const [search,     setSearch]     = useState("")
  const [staffMonth, setStaffMonth] = useState(() => {
    const d = new Date(initialDateFrom)
    return isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1
  })
  const [staffYear, setStaffYear] = useState(() => {
    const d = new Date(initialDateFrom)
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
  })

  const navigate = useCallback((overrides: Record<string, string>) => {
    const p = new URLSearchParams(searchP.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v && !(k === "branch" && v === "all")) p.set(k, v); else p.delete(k)
    }
    startT(() => router.push(`${pathname}?${p.toString()}`))
  }, [pathname, router, searchP])

  function applyDatePreset(preset: string) {
    const { from, to } = getPreset(preset)
    setDateFrom(from)
    setDateTo(to)
    navigate({ date_from: from, date_to: to, branch: branchId })
  }

  function applyFilters() {
    navigate({ date_from: dateFrom, date_to: dateTo, branch: branchId })
  }

  function applyStaffMonthFilter(month: number, year: number) {
    const { from, to } = getMonthRange(month, year)
    setDateFrom(from)
    setDateTo(to)
    navigate({ date_from: from, date_to: to, branch: branchId })
  }

  return {
    dateFrom, setDateFrom,
    dateTo,   setDateTo,
    branchId, setBranchId,
    search,   setSearch,
    staffMonth, setStaffMonth,
    staffYear,  setStaffYear,
    navigate,
    applyDatePreset,
    applyFilters,
    applyStaffMonthFilter,
  }
}
