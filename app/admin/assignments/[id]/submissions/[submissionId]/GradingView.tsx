'use client'

import { useActionState, useState } from 'react'
import { gradeSubmission } from '@/modules/assignments/submissions/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import type { Assignment } from '@/modules/assignments/types'
import type { Submission } from '@/modules/assignments/submissions/types'
import type { ActionResult } from '@/types/app'

interface Props {
  assignment: Assignment
  submission: Submission
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#0B1F3A] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
    >
      {label}
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm6.5-3a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V3.06l-6.22 6.22a.75.75 0 11-1.06-1.06L13.94 2H10.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
    </a>
  )
}

export default function GradingView({ assignment, submission }: Props) {
  const [rubricScores, setRubricScores] = useState<Record<string, number>>(
    submission.rubric_scores ?? {}
  )
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    gradeSubmission,
    null
  )

  const totalRubricScore = assignment.rubric.reduce(
    (sum, c) => sum + (rubricScores[c.id] ?? 0),
    0
  )

  return (
    <div className="space-y-5">
      {/* Submission info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-[#0B1F3A]">{submission.student_name}</p>
            <p className="text-xs text-[#94A3B8]">{submission.student_email}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={submission.status} />
            {submission.is_late && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                Late
              </span>
            )}
            {submission.resubmission_count > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Resubmission #{submission.resubmission_count}
              </span>
            )}
          </div>
        </div>

        <p className="mb-3 text-xs text-[#64748B]">
          Submitted {new Date(submission.submitted_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>

        {/* Submission content */}
        <div className="space-y-3">
          {submission.content && (
            <div>
              <p className="mb-1 text-xs font-medium text-[#64748B]">Written answer</p>
              <div className="rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#0B1F3A] whitespace-pre-wrap">
                {submission.content}
              </div>
            </div>
          )}

          {/* External links */}
          {(submission.drive_url || submission.github_url || submission.project_url || submission.video_url) && (
            <div>
              <p className="mb-2 text-xs font-medium text-[#64748B]">Submitted links</p>
              <div className="flex flex-wrap gap-2">
                {submission.drive_url && <ExternalLink href={submission.drive_url} label="Google Drive" />}
                {submission.github_url && <ExternalLink href={submission.github_url} label="GitHub" />}
                {submission.project_url && <ExternalLink href={submission.project_url} label="Project" />}
                {submission.video_url && <ExternalLink href={submission.video_url} label="Video" />}
              </div>
            </div>
          )}

          {submission.file_keys.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#64748B]">
                Attached files <span className="text-[#94A3B8]">({submission.file_keys.length})</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Grading form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Grade this submission</h2>

        {state && !state.success && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error.message}
          </div>
        )}
        {state?.success && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Grade saved.
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="submission_id" value={submission.id} />
          <input type="hidden" name="assignment_id" value={submission.assignment_id} />
          <input type="hidden" name="rubric_scores" value={JSON.stringify(rubricScores)} />

          {/* Rubric scoring */}
          {assignment.rubric.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-[#64748B]">
                Rubric scoring
                <span className="ml-2 text-[#94A3B8]">
                  ({totalRubricScore} / {assignment.rubric.reduce((s, c) => s + c.max_points, 0)} pts)
                </span>
              </p>
              <div className="space-y-2">
                {assignment.rubric.map((criterion) => (
                  <div key={criterion.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-[#0B1F3A]">{criterion.label}</span>
                    <input
                      type="number"
                      min="0"
                      max={criterion.max_points}
                      value={rubricScores[criterion.id] ?? 0}
                      onChange={(e) => setRubricScores((prev) => ({
                        ...prev,
                        [criterion.id]: Number(e.target.value),
                      }))}
                      className="w-16 rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm text-center text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
                    />
                    <span className="w-12 text-xs text-[#94A3B8]">/ {criterion.max_points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">
                Score <span className="text-[#94A3B8]">(max {assignment.max_score})</span>
              </label>
              <input
                name="score"
                type="number"
                min="0"
                max={assignment.max_score}
                defaultValue={submission.score ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
              <select
                name="status"
                defaultValue={submission.status}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under review</option>
                <option value="graded">Graded</option>
                <option value="returned">Returned</option>
                <option value="resubmission_requested">Request resubmission</option>
              </select>
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Instructor feedback (private)</label>
            <textarea
              name="feedback"
              rows={3}
              defaultValue={submission.feedback ?? ''}
              placeholder="Only visible to the student and instructors…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Public feedback</label>
            <textarea
              name="public_feedback"
              rows={2}
              defaultValue={submission.public_feedback ?? ''}
              placeholder="Visible to parents…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
              <input
                name="portfolio_visible"
                type="checkbox"
                value="on"
                defaultChecked={submission.portfolio_visible}
                className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
              />
              Add to student portfolio
            </label>
            <SubmitButton label="Save grade" pendingLabel="Saving…" />
          </div>
        </form>
      </div>
    </div>
  )
}
