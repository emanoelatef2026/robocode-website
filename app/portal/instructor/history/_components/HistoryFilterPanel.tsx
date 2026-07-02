"use client"

import Link from "next/link"
import { useState } from "react"

interface Group {
  group_id: string
  group_name: string
  course_title: string | null
}

interface Props {
  groups:    Group[]
  from?:     string
  to?:       string
  groupId?:  string
  topic?:    string
  tab?:      string
}

export default function HistoryFilterPanel({ groups, from, to, groupId, topic, tab }: Props) {
  const hasActive = !!(from || to || groupId || topic)
  const [expanded, setExpanded] = useState(hasActive)

  return (
    <div className="ds-card overflow-hidden">
      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-semibold text-[#0B1F3A]"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#94A3B8]">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filters
          {hasActive && (
            <span className="inline-flex h-2 w-2 rounded-full bg-[#FF8A1F]" />
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-[#94A3B8] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Filter form */}
      {expanded && (
        <form method="GET" className="border-t border-[#F1F5F9] px-3 pb-3 pt-2.5">
          {tab && tab !== 'done' && <input type="hidden" name="tab" value={tab} />}
          {/* Row 1: Group + dates + topic */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Group</label>
              <select
                name="groupId"
                defaultValue={groupId ?? ""}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
              >
                <option value="">All groups</option>
                {groups.map(g => (
                  <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">From</label>
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">To</label>
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Topic</label>
              <input
                type="text"
                name="topic"
                defaultValue={topic ?? ""}
                placeholder="Search topic…"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] placeholder-[#CBD5E1] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#FF8A1F] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#e07818] active:scale-[0.98] transition"
            >
              Apply
            </button>
            {hasActive && (
              <Link
                href={tab && tab !== 'done' ? `/portal/instructor/history?tab=${tab}` : '/portal/instructor/history'}
                className="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-[12px] font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
