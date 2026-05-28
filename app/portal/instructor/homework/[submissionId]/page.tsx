import { requirePortalRole } from '@/modules/rbac/guards'
import { getSubmission } from '@/modules/assignments/submissions/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import GradeForm from './GradeForm'

interface Props { params: Promise<{ submissionId: string }> }

export default async function GradeSubmissionPage({ params }: Props) {
  await requirePortalRole('instructor')
  const { submissionId } = await params

  const submission = await getSubmission(submissionId)
  if (!submission) notFound()

  const links = [
    { label: 'Drive',   url: submission.drive_url },
    { label: 'GitHub',  url: submission.github_url },
    { label: 'Project', url: submission.project_url },
    { label: 'Video',   url: submission.video_url },
  ].filter((l) => l.url)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/portal/instructor/homework" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Homework Review
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#0B1F3A]">Grade Submission</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          {submission.assignment_title} · {submission.student_name}
        </p>
      </div>

      {/* Submission content */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Submission</p>
          <p className="text-xs text-[#94A3B8]">
            {new Date(submission.submitted_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            } as Intl.DateTimeFormatOptions)}
            {submission.is_late && <span className="ml-2 text-red-500">late</span>}
          </p>
        </div>

        {submission.content && (
          <div>
            <p className="text-xs font-medium uppercase text-[#94A3B8]">Content</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm text-[#0B1F3A]">
              {submission.content}
            </p>
          </div>
        )}

        {links.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase text-[#94A3B8]">Links</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {links.map(({ label, url }) => (
                <a
                  key={label}
                  href={url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#3B82F6] hover:bg-[#F8FAFC] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grade form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-[#0B1F3A]">Grade</p>
        <GradeForm submission={submission} />
      </div>
    </div>
  )
}
