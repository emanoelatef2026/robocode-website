import { initials } from '../utils'

export function Avatar({ first, last, email, size = 'md', selected = false }: {
  first:     string | null
  last:      string | null
  email:     string
  size?:     'sm' | 'md' | 'lg'
  selected?: boolean
}) {
  const ini     = initials(first, last, email)
  const sizeMap = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-[12px]', lg: 'h-12 w-12 text-[16px]' }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeMap[size]} ${selected ? 'bg-[#FF8A1F] text-white' : 'bg-[#0B1F3A] text-white'}`}>
      {ini}
    </div>
  )
}
