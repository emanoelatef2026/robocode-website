'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startGroupSession } from '@/modules/instructor-portal/actions'

interface Props {
  groupId:       string
  groupCourseId: string
  branchId:      string
}

export default function StartGroupSessionButton({ groupId, groupCourseId, branchId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleStart = () => {
    startTransition(async () => {
      const result = await startGroupSession(groupCourseId, groupId, branchId)
      if (result.success) {
        router.push(`/portal/instructor/groups/${groupId}/sessions/${result.data.sessionId}`)
      } else {
        alert(result.error.message)
      }
    })
  }

  return (
    <button
      onClick={handleStart}
      disabled={isPending}
      className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
    >
      {isPending ? 'Starting…' : 'Start Session'}
    </button>
  )
}
