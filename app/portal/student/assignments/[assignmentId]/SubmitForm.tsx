'use client'

import { useActionState, useRef, useState } from 'react'
import { submitAssignment } from '@/modules/assignments/submissions/actions'
import { compressToFile } from '@/lib/uploads/compressImage'
import type { AssignmentSubmissionType } from '@/types/enums'
import type { Submission } from '@/modules/assignments/submissions/types'

interface Props {
  assignmentId:   string
  submissionType: AssignmentSubmissionType
  submission:     Submission | null
  maxScore:       number
}

interface UploadedImage {
  url:      string
  previewSrc: string
  name:     string
}

const INITIAL_STATE = { success: false as const, error: { code: '', message: '' } }

export default function SubmitForm({ assignmentId, submissionType, submission, maxScore }: Props) {
  const [state, action, pending] = useActionState(submitAssignment, INITIAL_STATE)

  // ── Image upload state ────────────────────────────────────────────────────────
  const [images, setImages]         = useState<UploadedImage[]>([])
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isResubmit =
    submission?.status === 'resubmission_requested' ||
    submission?.status === 'returned'

  const alreadySubmitted = !!submission && !isResubmit

  const showText   = submissionType === 'text'       || submissionType === 'multiple'
  const showDrive  = submissionType === 'drive_link'  || submissionType === 'multiple'
  const showGithub = submissionType === 'github_link' || submissionType === 'multiple'
  const showUrl    = submissionType === 'url'         || submissionType === 'multiple'
  const showVideo  = submissionType === 'video_link'  || submissionType === 'multiple'
  const showImage  = submissionType === 'image'       || submissionType === 'multiple'

  // ── Handle image pick & upload ───────────────────────────────────────────────
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (images.length + files.length > 5) {
      setUploadError('Maximum 5 images allowed.')
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      const uploaded: UploadedImage[] = []
      for (const file of files) {
        const compressed = await compressToFile(file, { maxKB: 100, maxWidth: 1200 })
        const fd = new FormData()
        fd.set('file', compressed)
        const res = await fetch('/api/uploads/submission-image', { method: 'POST', body: fd })
        const json = await res.json() as { url?: string; error?: string }
        if (!res.ok || !json.url) {
          setUploadError(json.error ?? 'Upload failed. Please try again.')
          break
        }
        uploaded.push({
          url:        json.url,
          previewSrc: URL.createObjectURL(compressed),
          name:       file.name,
        })
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch {
      setUploadError('Image upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== idx)
      return updated
    })
  }

  if (alreadySubmitted) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
        <p className="font-medium text-[#0B1F3A]">Submission received</p>
        <p className="mt-1 text-sm text-[#64748B]">
          {submission!.public_feedback
            ? `Instructor feedback: ${submission!.public_feedback}`
            : 'Your instructor will review and grade your submission.'}
        </p>
        {submission!.score != null && (
          <p className="mt-3 text-lg font-bold text-[#0B1F3A]">
            Score: {submission!.score} / {maxScore}
          </p>
        )}
        {/* Show previously uploaded images */}
        {submission!.image_urls && submission!.image_urls.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#64748B]">Submitted images</p>
            <div className="flex flex-wrap gap-2">
              {submission!.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`submission image ${i + 1}`}
                    className="h-20 w-20 rounded-lg border border-[#E2E8F0] object-cover hover:opacity-80 transition" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      {/* Pass uploaded image URLs as hidden fields */}
      {images.map((img, i) => (
        <input key={i} type="hidden" name="image_urls[]" value={img.url} />
      ))}

      {isResubmit && (
        <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Your instructor requested a resubmission.
          {submission!.feedback && <p className="mt-1 font-medium">{submission!.feedback}</p>}
        </div>
      )}

      {showText && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            Answer / Content
          </label>
          <textarea
            name="content"
            rows={6}
            defaultValue={isResubmit ? (submission?.content ?? '') : ''}
            placeholder="Write your answer here…"
            className="w-full ds-card px-4 py-3 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
          />
        </div>
      )}

      {showImage && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            Images
            <span className="ml-1 text-xs font-normal text-[#64748B]">
              (up to 5, auto-compressed to ~100 KB each)
            </span>
          </label>

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img.previewSrc} alt={img.name}
                    className="h-20 w-20 rounded-lg border border-[#E2E8F0] object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white hover:bg-[#DC2626] transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="mb-2 text-xs text-[#EF4444]">{uploadError}</p>
          )}

          {images.length < 5 && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImagePick}
                className="hidden"
                id="image-upload"
                disabled={uploading}
              />
              <label
                htmlFor="image-upload"
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E2E8F0] px-4 py-3 text-sm transition
                  ${uploading ? 'cursor-not-allowed opacity-50' : 'hover:border-[#FF8A1F] hover:text-[#FF8A1F]'} text-[#64748B]`}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Uploading…
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                    </svg>
                    {images.length === 0 ? 'Choose images' : 'Add more images'}
                    <span className="text-xs text-[#64748B]">({5 - images.length} remaining)</span>
                  </>
                )}
              </label>
            </div>
          )}
        </div>
      )}

      {showDrive && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            Google Drive link
          </label>
          <input
            type="url"
            name="drive_url"
            defaultValue={isResubmit ? (submission?.drive_url ?? '') : ''}
            placeholder="https://drive.google.com/…"
            className="w-full ds-card px-4 py-3 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
          />
        </div>
      )}

      {showGithub && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            GitHub repository
          </label>
          <input
            type="url"
            name="github_url"
            defaultValue={isResubmit ? (submission?.github_url ?? '') : ''}
            placeholder="https://github.com/…"
            className="w-full ds-card px-4 py-3 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
          />
        </div>
      )}

      {showUrl && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            Project URL
          </label>
          <input
            type="url"
            name="project_url"
            defaultValue={isResubmit ? (submission?.project_url ?? '') : ''}
            placeholder="https://…"
            className="w-full ds-card px-4 py-3 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
          />
        </div>
      )}

      {showVideo && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
            Video link (YouTube / Vimeo)
          </label>
          <input
            type="url"
            name="video_url"
            defaultValue={isResubmit ? (submission?.video_url ?? '') : ''}
            placeholder="https://youtube.com/…"
            className="w-full ds-card px-4 py-3 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
          />
        </div>
      )}

      {!state.success && state.error?.message && (
        <p className="rounded-lg bg-[#FEE2E2] px-4 py-2 text-sm text-[#EF4444]">{state.error.message}</p>
      )}

      {state.success && (
        <p className="rounded-lg bg-[#E7F8EE] px-4 py-2 text-sm text-[#15803D]">
          Submitted successfully!
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="w-full rounded-lg bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#FF8A1F] disabled:cursor-not-allowed disabled:opacity-60"
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
