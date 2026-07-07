import Link from 'next/link'
import type { ParentChildSummary } from '@/modules/parents/parent-portal-queries'

interface Props {
  linkedChildren: ParentChildSummary[]
  selectedId:     string
  hrefFor:        (studentId: string) => string
}

// Shared multi-child switcher for parent-portal pages. Renders nothing for
// single-child accounts — every page besides Dashboard/Finance relied on the
// sidebar hamburger to switch children, which this makes consistent and visible.
export default function ChildSelector({ linkedChildren, selectedId, hrefFor }: Props) {
  if (linkedChildren.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2">
      {linkedChildren.map(c => (
        <Link
          key={c.student_id}
          href={hrefFor(c.student_id)}
          className={[
            'flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
            c.student_id === selectedId
              ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
              : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
          ].join(' ')}
        >
          <span className={[
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
            c.student_id === selectedId ? 'bg-[#FF8A1F] text-white' : 'bg-[#E2E8F0] text-[#64748B]',
          ].join(' ')}>
            {c.student_name.charAt(0).toUpperCase()}
          </span>
          {c.student_name}
        </Link>
      ))}
    </div>
  )
}
