'use client'

import { useActionState } from 'react'
import { createAchievement } from '@/modules/portfolio/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

interface Props {
  studentId:   string
  portfolioId: string | null
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const ACHIEVEMENT_TYPES = ['project', 'competition', 'certificate', 'leadership', 'attendance', 'innovation', 'custom'] as const

export default function NewAchievementForm({ studentId, portfolioId }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createAchievement,
    null
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="student_id"   value={studentId} />
        {portfolioId && <input type="hidden" name="portfolio_id" value={portfolioId} />}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Title <span className="text-red-500">*</span>
          </label>
          <input name="title" required className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={3} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-red-500">*</span>
            </label>
            <select name="achievement_type" required className={inputClass}>
              {ACHIEVEMENT_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Date Awarded <span className="text-red-500">*</span>
            </label>
            <input name="date_awarded" type="date" required defaultValue={today} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Image URL</label>
          <input name="image_url" type="url" placeholder="https://…" className={inputClass} />
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          <Link href={`/admin/portfolio/${studentId}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            Cancel
          </Link>
          <SubmitButton label="Add Achievement" pendingLabel="Adding…" />
        </div>
      </form>
    </div>
  )
}
