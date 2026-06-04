'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { GlobalSearchHit, GlobalSearchResponse } from '@/modules/search/globalSearch'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function hitUrl(hit: GlobalSearchHit, portalBase: string): string {
  switch (hit.type) {
    case 'student':    return `${portalBase}/students/${hit.id}`
    case 'instructor': return `${portalBase}/instructors/${hit.id}`
    case 'course':     return `${portalBase}/courses/${hit.id}`
    case 'group':      return `${portalBase}/groups/${hit.id}`
    default:           return '#'
  }
}

// ── Hit row ────────────────────────────────────────────────────────────────────

function HitRow({
  hit, active, portalBase, onSelect,
}: {
  hit: GlobalSearchHit
  active: boolean
  portalBase: string
  onSelect: (url: string) => void
}) {
  const url = hitUrl(hit, portalBase)
  return (
    <button
      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-[#FFF4E8]' : 'hover:bg-[#F8FAFC]'}`}
      onMouseDown={e => { e.preventDefault(); onSelect(url) }}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
        ${hit.type === 'student'    ? 'bg-orange-100 text-[#FF8A1F]' :
          hit.type === 'instructor' ? 'bg-blue-100 text-blue-600'    :
          hit.type === 'course'     ? 'bg-purple-100 text-purple-600' :
          'bg-slate-100 text-slate-600'}`}
      >
        {hit.type === 'student'    ? 'S' :
         hit.type === 'instructor' ? 'I' :
         hit.type === 'course'     ? 'C' : 'G'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="truncate text-sm font-medium text-[#0B1F3A]">{hit.name}</p>
          {hit.student_code && <span className="shrink-0 font-mono text-[10px] text-[#94A3B8]">#{hit.student_code}</span>}
          {hit.quick_action && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              hit.quick_action.includes('Blocked') ? 'bg-red-100 text-red-700' :
              hit.quick_action.includes('Collect') ? 'bg-amber-100 text-amber-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {hit.quick_action}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-[#94A3B8]">
          {hit.type === 'student' && [hit.branch_name, hit.parent_name, hit.phone].filter(Boolean).join(' · ')}
          {hit.type !== 'student' && hit.subtitle}
          {hit.next_due_date && ` · Due ${new Date(hit.next_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        </p>
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  branchIds:  string[]
  portalBase: string   // e.g. "/portal/team-leader"
  placeholder?: string
  onSelectStudent?: (studentId: string) => void
}

export default function GlobalSearchInput({
  branchIds, portalBase, placeholder = 'Search students, courses, groups…', onSelectStudent,
}: Props) {
  const router = useRouter()
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<GlobalSearchResponse | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [cursor,   setCursor]   = useState(-1)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Flat ordered list of all hits
  const allHits: GlobalSearchHit[] = results
    ? [...results.students, ...results.instructors, ...results.courses, ...results.groups]
    : []

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return }
    setLoading(true)
    try {
      const qs  = new URLSearchParams({ q, branchIds: branchIds.join(',') })
      const res = await fetch(`/api/search?${qs}`)
      if (res.ok) {
        const data: GlobalSearchResponse = await res.json()
        setResults(data)
        setOpen(true)
        setCursor(-1)
      }
    } finally {
      setLoading(false)
    }
  }, [branchIds])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || allHits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, allHits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault()
      const hit = allHits[cursor]
      handleSelect(hit)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleSelect(hit: GlobalSearchHit) {
    if (hit.type === 'student' && onSelectStudent) {
      onSelectStudent(hit.id)
      setQuery('')
      setOpen(false)
      return
    }
    const url = hitUrl(hit, portalBase)
    router.push(url)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2.5 pl-10 pr-9 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
          </span>
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults(null); setOpen(false); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && allHits.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-85 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
          {results?.students && results.students.length > 0 && (
            <div>
              <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Students</p>
              {results.students.map((hit, i) => (
                <HitRow key={hit.id} hit={hit} active={cursor === i} portalBase={portalBase} onSelect={() => handleSelect(hit)} />
              ))}
            </div>
          )}
          {results?.instructors && results.instructors.length > 0 && (
            <div className="border-t border-[#F1F5F9]">
              <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Instructors</p>
              {results.instructors.map((hit, i) => (
                <HitRow key={hit.id} hit={hit} active={cursor === results.students.length + i} portalBase={portalBase} onSelect={() => handleSelect(hit)} />
              ))}
            </div>
          )}
          {results?.courses && results.courses.length > 0 && (
            <div className="border-t border-[#F1F5F9]">
              <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Courses</p>
              {results.courses.map((hit, i) => (
                <HitRow key={hit.id} hit={hit} active={cursor === results.students.length + results.instructors.length + i} portalBase={portalBase} onSelect={() => handleSelect(hit)} />
              ))}
            </div>
          )}
          {results?.groups && results.groups.length > 0 && (
            <div className="border-t border-[#F1F5F9]">
              <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Groups</p>
              {results.groups.map((hit, i) => (
                <HitRow key={hit.id} hit={hit} active={cursor === results.students.length + results.instructors.length + results.courses.length + i} portalBase={portalBase} onSelect={() => handleSelect(hit)} />
              ))}
            </div>
          )}
          <div className="border-t border-[#F1F5F9] px-4 py-2 text-center text-[10px] text-[#94A3B8]">
            ↑↓ navigate · Enter to open · Esc to close
          </div>
        </div>
      )}

      {open && query.length >= 2 && !loading && allHits.length === 0 && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-lg text-center">
          <p className="text-sm text-[#94A3B8]">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
