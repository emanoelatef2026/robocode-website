'use client'

import { useActionState } from 'react'
import { submitAssignment } from '@/modules/assignments/submissions/actions'
import type { AssignmentSubmissionType } from '@/types/enums'
import type { Submission } from '@/modules/assignments/submissions/types'

interface Props {
  assignmentId:   string
  submissionType: AssignmentSubmissionType
  submission:     Submission | null
  maxScore:       number
}

const INITIAL_STATE = { success: false as const, error: { code: '', message: '' } }

export default function SubmitForm({ assignmentId, submissionType, submission, maxScore }: Props) {
  const [state, action, pending] = useActionState(submitAssignment, INITIAL_STATE)

  const isResubmit =
    submission?.status === 'resubmission_requested' ||
    submission?.status === 'returned'

  const alreadySubmitted = !!submission && !isResubmit

  if (alreadySubmitted) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
        <p className="font-medium text-[#0B132B]">Submission received</p>
        <p className="mt-1 text-sm text-[#64748B]">
          {submission!.public_feedback
            ? `Instructor feedback: ${submission!.public_feedback}`
            : 'Your instructor will review and grade your submission.'}
        </p>
        {submission!.score != null && (
          <p className="mt-3 text-lg font-bold text-[#0B132B]">
            Score: {submission!.score} / {maxScore}
          </p>
        )}
      </div>
    )
  }

  const showText   = submissionType === 'text'     || submissionType === 'multiple'
  const showDrive  = submissionType === 'drive_link'  || submissionType === 'multiple'
  const showGithub = submissionType === 'github_link' || submissionType === 'multiple'
  const showUrl    = submissionType === 'url'      || submissionType === 'multiple'
  const showVideo  = submissionType === 'video_link'  || submissionType === 'multiple'

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="assignment_id" value={assignmentId} />

      {isResubmit && (
        <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Your instructor requested a resubmission.
          {submission!.feedback && <p className="mt-1 font-medium">{submission!.feedback}</p>}
        </div>
      )}

      {showText && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B132B]">
            Answer / Content
          </label>
          <textarea
            name="content"
            rows={6}
            defaultValue={isResubmit ? (submission?.content ?? '') : ''}
            placeholder="Write your answer here…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0B132B] outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>
      )}

      {showDrive && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B132B]">
            Google Drive link
          </label>
          <input
            type="url"
            name="drive_url"
            defaultValue={isResubmit ? (submission?.drive_url ?? '') : ''}
            placeholder="https://drive.google.com/…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>
      )}

      {showGithub && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B132B]">
            GitHub repository
          </label>
          <input
            type="url"
            name="github_url"
            defaultValue={isResubmit ? (submission?.github_url ?? '') : ''}
            placeholder="https://github.com/…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>
      )}

      {showUrl && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B132B]">
            Project URL
          </label>
          <input
            type="url"
            name="project_url"
            defaultValue={isResubmit ? (submission?.project_url ?? '') : ''}
            placeholder="https://…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>
      )}

      {showVideo && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B132B]">
            Video link (YouTube / Vimeo)
          </label>
          <input
            type="url"
            name="video_url"
            defaultValue={isResubmit ? (submission?.video_url ?? '') : ''}
            placeholder="https://youtube.com/…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>
      )}

      {!state.success && state.error?.message && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{state.error.message}</p>
      )}

      {state.success && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Submitted successfully!
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#0B132B] py-3 text-sm font-semibold text-white transition hover:bg-[#19C6F4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? 'Submitting…'
          : isResubmit
          ? 'Resubmit'
          : 'Submit Assignment'}
      </button>
    </form>
  )
}
