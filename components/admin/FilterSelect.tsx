'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Option {
  value: string
  label: string
}

interface Props {
  name: string
  value: string
  placeholder: string
  options: Option[]
  className?: string
}

export default function FilterSelect({ name, value, placeholder, options, className }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const handleChange = (newValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newValue) params.set(name, newValue)
    else params.delete(name)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={
        className ??
        'rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]'
      }
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
