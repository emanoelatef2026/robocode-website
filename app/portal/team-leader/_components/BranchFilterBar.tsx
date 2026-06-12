'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition }          from 'react'

interface Branch {
  id:   string
  name: string
}

interface Props {
  branches: Branch[]
  selected: string | null
}

export default function BranchFilterBar({ branches, selected }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  if (branches.length <= 1) return null

  function handleChange(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('branch', value)
    const url = params.toString() ? `${pathname}?${params}` : pathname
    startTransition(() => { router.replace(url) })
  }

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
      <select
        defaultValue={selected ?? ''}
        onChange={e => handleChange(e.target.value)}
        disabled={pending}
        className={`rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none transition ${pending ? 'opacity-50 cursor-wait' : 'hover:border-[#CBD5E1]'}`}
      >
        <option value="">All Branches</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
