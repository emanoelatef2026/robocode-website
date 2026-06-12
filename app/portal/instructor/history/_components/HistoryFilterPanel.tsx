"use client"

import { useState } from "react"

interface Group {
  group_id: string
  group_name: string
  course_title: string | null
}

interface Props {
  groups: Group[]
  from?: string
  to?: string
  groupId?: string
  topic?: string
  status?: string
}

export default function HistoryFilterPanel({ groups, from, to, groupId, topic, status }: Props) {
  const hasActive = !!(from || to || groupId || topic || status)
  const [expanded, setExpanded] = useState(hasActive)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      {/* Mobile toggle — hidden on sm+ */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[#0B1F3A] sm:hidden"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8]">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filters
          {hasActive && (
            <span className="inline-flex h-2 w-2 rounded-full bg-[#FF8A1F]" aria-label="Active filters" />
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

      {/* Filter form — always visible sm+, toggled on mobile */}
      <form
        method="GET"
        className={[
          "px-4 pb-4 sm:block sm:pt-4",
          expanded ? "block pt-0" : "hidden",
        ].join(" ")}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Group</label>
            <select
              name="groupId"
              defaultValue={groupId ?? ""}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Topic</label>
            <input
              type="text"
              name="topic"
              defaultValue={topic ?? ""}
              placeholder="Search topics…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="ongoing">Ongoing</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] transition"
          >
            Apply Filters
          </button>
          <a
            href="/portal/instructor/history"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
          >
            Clear
          </a>
        </div>
      </form>
    </div>
  )
}
