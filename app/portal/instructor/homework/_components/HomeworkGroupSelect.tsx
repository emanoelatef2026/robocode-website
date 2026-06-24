'use client'

import { useRouter } from 'next/navigation'
import type { InstructorGroup } from '@/modules/instructor-portal/types'

interface Props {
  groups: Pick<InstructorGroup, 'group_id' | 'group_name'>[]
  currentFilter: 'pending' | 'reviewed' | 'all'
  currentGroupId: string | undefined
}

export function HomeworkGroupSelect({ groups, currentFilter, currentGroupId }: Props) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams()
    params.set('filter', currentFilter)
    if (e.target.value) params.set('groupId', e.target.value)
    router.push(`/portal/instructor/homework?${params.toString()}`)
  }

  return (
    <select
      value={currentGroupId ?? ''}
      onChange={handleChange}
      className="ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
    >
      <option value="">All groups</option>
      {groups.map((g) => (
        <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
      ))}
    </select>
  )
}
