'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Option {
  value: string
  label: string
}

interface Props {
  param:       string
  options:     Option[]
  placeholder: string
  className?:  string
}

export default function AdminFilterSelect({ param, options, placeholder, className }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const current      = searchParams.get(param) ?? ''

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set(param, e.target.value)
    } else {
      params.delete(param)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const cls = className ?? 'rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]'

  return (
    <select value={current} onChange={handleChange} className={cls}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
