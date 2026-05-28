'use client'

import { deactivateTeamLeader } from '@/modules/team-leaders/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props { userId: string }

export default function DeactivateTeamLeaderButton({ userId }: Props) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (!confirm('Deactivate this team leader? Their portal access will be revoked immediately.')) return
    setBusy(true)
    const result = await deactivateTeamLeader(userId)
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error.message)
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? 'Deactivating…' : 'Deactivate'}
    </button>
  )
}
