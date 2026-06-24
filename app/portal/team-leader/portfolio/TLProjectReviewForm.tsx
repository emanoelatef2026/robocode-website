'use client'

import { useActionState, useState } from 'react'
import { tlReviewProject, tlAssignBadge } from '@/modules/portfolio/tl-actions'
import type { ActionResult } from '@/types/app'

const BADGE_OPTIONS = [
  { name: 'Featured Project',      emoji: '🏆' },
  { name: 'Best Project Video',     emoji: '🎥' },
  { name: 'Best Game Project',      emoji: '🎮' },
  { name: 'Best AI Project',        emoji: '🧠' },
  { name: 'Best Robotics Project',  emoji: '🤖' },
  { name: 'Best Website Project',   emoji: '🌐' },
]

interface Props {
  projectId:       string
  studentId:       string
  currentFeedback: string | null
  currentScore:    number | null
  currentStatus:   string | null
}

const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function TLProjectReviewForm({ projectId, studentId, currentFeedback, currentScore, currentStatus }: Props) {
  const [reviewState, reviewAction, reviewPending] = useActionState<ActionResult<void> | null, FormData>(
    tlReviewProject, null
  )
  const [badgeState, badgeAction, badgePending] = useActionState<ActionResult<void> | null, FormData>(
    tlAssignBadge, null
  )
  const [showBadge, setShowBadge] = useState(false)

  return (
    <div className="space-y-4">
      <form action={reviewAction} className="space-y-3">
        <input type="hidden" name="project_id" value={projectId} />

        {reviewState && !reviewState.success && (
          <div className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">{reviewState.error.message}</div>
        )}
        {reviewState?.success && (
          <div className="rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">Saved.</div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Feedback for student</label>
          <textarea name="instructor_feedback" rows={2} defaultValue={currentFeedback ?? ''}
            placeholder="What's good? What needs work?" className={cls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Score (0–100)</label>
            <input name="final_score" type="number" min={0} max={100}
              defaultValue={currentScore ?? ''} placeholder="e.g. 92" className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Decision</label>
            <select name="status"
              defaultValue={currentStatus === 'featured' ? 'featured' : currentStatus === 'approved' ? 'approved' : 'approved'}
              className={cls}>
              <option value="approved">Approve</option>
              <option value="needs_improvement">Needs Improvement</option>
              <option value="featured">Feature It ⭐</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={reviewPending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition">
            {reviewPending ? 'Saving…' : 'Save Review'}
          </button>
          <button type="button" onClick={() => setShowBadge((b) => !b)}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#FF8A1F] transition">
            {showBadge ? 'Hide Badge' : '🏅 Assign Badge'}
          </button>
        </div>
      </form>

      {showBadge && (
        <form action={badgeAction} className="space-y-3 rounded-lg border border-[#E2E8F0] p-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="student_id" value={studentId} />

          {badgeState && !badgeState.success && (
            <div className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">{badgeState.error.message}</div>
          )}
          {badgeState?.success && (
            <div className="rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">Badge assigned.</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Badge</label>
            <select name="badge_name" className={cls}>
              {BADGE_OPTIONS.map((b) => (
                <option key={b.name} value={b.name}>{b.emoji} {b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Note (optional)</label>
            <input name="description" placeholder="e.g. Outstanding creativity" className={cls} />
          </div>
          <button type="submit" disabled={badgePending}
            className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-60 transition">
            {badgePending ? 'Assigning…' : 'Assign Badge'}
          </button>
        </form>
      )}
    </div>
  )
}
