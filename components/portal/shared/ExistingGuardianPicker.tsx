'use client'

import { useEffect, useId, useState } from 'react'
import { searchExistingGuardians } from '@/modules/parents/search-actions'
import type { ParentSearchResult } from '@/modules/parents/registration'

export function ExistingGuardianPicker({ onSelect }: { onSelect: (guardian: ParentSearchResult) => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ParentSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setError(''); setLoading(false); return }
      setLoading(true)
      try {
        const result = await searchExistingGuardians(query)
        if (!active) return
        setResults(result.success ? result.data : [])
        setError(result.success ? '' : result.error.message)
      } catch { if (active) { setResults([]); setError('Could not search guardians. Try again.') } }
      finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query])
  return (
    <div className="space-y-2 rounded-xl border border-[#D5E1EE] bg-[#F8FAFC] p-3">
      <label htmlFor={id} className="block text-sm font-semibold text-[#0B1F3A]">Find existing parent / guardian</label>
      <p className="text-xs font-medium text-[#526985]">For siblings, select the same guardian. Each child keeps their own record.</p>
      <input id={id} type="search" value={query} onChange={e => { setQuery(e.target.value); setResults([]) }}
        placeholder="Search by phone or guardian name…" maxLength={100}
        className="ds-input w-full rounded-lg border border-[#D5E1EE] bg-white px-3 py-2.5 text-sm text-[#0B1F3A]" />
      <div aria-live="polite">
        {loading && <p className="text-sm text-[#526985]">Searching…</p>}
        {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
        {!loading && !error && query.trim().length >= 2 && results.length === 0 && <p className="text-xs text-[#526985]">No results yet. Try the phone number or enter a new guardian below.</p>}
      </div>
      {results.length > 0 && <ul className="max-h-56 overflow-y-auto rounded-lg border border-[#D5E1EE] bg-white">
        {results.map(parent => <li key={parent.contactId} className="border-b border-[#E2E8F0] last:border-0">
          <button type="button" onClick={() => { onSelect(parent); setQuery(''); setResults([]) }} className="w-full px-3 py-3 text-left hover:bg-[#EFF6FB] focus-visible:outline-2 focus-visible:outline-[#0E7490]">
            <span className="block text-sm font-semibold text-[#0B1F3A]">{parent.name} · {parent.phone1}</span>
            <span className="block text-xs font-medium text-[#526985]">Children: {parent.children.join(', ') || 'Existing family'}</span>
          </button>
        </li>)}
      </ul>}
    </div>
  )
}
