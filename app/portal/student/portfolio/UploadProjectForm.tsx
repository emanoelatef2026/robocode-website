'use client'

import { useActionState, useState, useRef, useCallback } from 'react'
import { submitPortfolioProject, editPortfolioProject } from '@/modules/portfolio/student-actions'
import type { ActionResult } from '@/types/app'

const CATEGORIES = ['Game', 'AI', 'Website', 'Robotics', 'Mobile App', 'Other'] as const

const MAX_BYTES    = 500 * 1024
const MAX_WIDTH_PX = 1200

interface ExistingProject {
  id:           string
  title:        string
  description:  string | null
  category:     string | null
  project_url:  string | null
  video_url:    string | null
  thumbnail_url: string | null
}

interface Props {
  mode?:     'create' | 'edit'
  project?:  ExistingProject
  onCancel?: () => void
}

// ── Browser-side image resize + compress ──────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas    = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_WIDTH_PX) {
        height = Math.round((height * MAX_WIDTH_PX) / width)
        width  = MAX_WIDTH_PX
      }
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until ≤ 500 KB
      const tryQuality = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return }
            if (blob.size <= MAX_BYTES || q <= 0.3) {
              resolve(blob)
            } else {
              tryQuality(Math.round((q - 0.1) * 10) / 10)
            }
          },
          'image/jpeg',
          q
        )
      }
      tryQuality(0.85)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

export default function UploadProjectForm({ mode = 'create', project, onCancel }: Props) {
  const isEdit = mode === 'edit'
  const action = isEdit ? editPortfolioProject : submitPortfolioProject

  const [state, formAction, pending] = useActionState<ActionResult<unknown> | null, FormData>(
    action as (prev: unknown, fd: FormData) => Promise<ActionResult<unknown>>,
    null
  )

  const [imageUrl,       setImageUrl]       = useState(project?.thumbnail_url ?? '')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError,     setImageError]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setImageError('Only JPEG, PNG, or WebP images are allowed.')
      return
    }

    setImageError(null)
    setImageUploading(true)

    try {
      const compressed = await compressImage(file)
      const fd         = new FormData()
      fd.append('file', compressed, 'image.jpg')

      const res  = await fetch('/api/portfolio/upload-image', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setImageError(json.error ?? 'Upload failed.')
      } else {
        setImageUrl(json.url)
      }
    } catch (err) {
      setImageError('Image processing failed. Try a different image.')
    } finally {
      setImageUploading(false)
    }
  }, [])

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  const isSuccess = state?.success === true

  if (isSuccess) {
    return (
      <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] p-5 text-center">
        <p className="font-semibold text-[#065F46]">
          {isEdit ? 'Project updated.' : 'Project submitted for review!'}
        </p>
        <p className="mt-1 text-sm text-[#15803D]">Your instructor will review it soon.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && project && (
        <input type="hidden" name="project_id" value={project.id} />
      )}
      <input type="hidden" name="thumbnail_url" value={imageUrl} />

      {/* Error */}
      {state && !state.success && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {(state as any).error?.message ?? 'Something went wrong.'}
        </div>
      )}

      {/* Image upload */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Cover Image <span className="text-[#EF4444]">*</span>
          <span className="ml-1 font-normal text-[#94A3B8]">(JPEG/PNG/WebP, auto-compressed to ≤500 KB)</span>
        </label>
        {imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Cover" className="h-40 w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => { setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
              className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-[#EF4444] shadow hover:bg-white"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#E2E8F0] p-8 text-center transition hover:border-[#FF8A1F]"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-sm text-[#64748B]">{imageUploading ? 'Uploading…' : 'Click to select image'}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Max 1200px wide · auto-compressed</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
          disabled={imageUploading}
        />
        {imageError && <p className="mt-1 text-xs text-[#EF4444]">{imageError}</p>}
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Project Title <span className="text-[#EF4444]">*</span>
        </label>
        <input name="title" required defaultValue={project?.title ?? ''} placeholder="e.g. My Space Invaders Game" className={cls} />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Project Description <span className="text-[#EF4444]">*</span>
        </label>
        <textarea name="description" required rows={3} defaultValue={project?.description ?? ''} placeholder="Describe what the project does and what you learned…" className={cls} />
      </div>

      {/* Category */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Category <span className="text-[#EF4444]">*</span>
        </label>
        <select name="category" required defaultValue={project?.category ?? 'Other'} className={cls}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Project link */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Project Link <span className="text-[#EF4444]">*</span>
          <span className="ml-1 font-normal text-[#94A3B8]">(Google Drive, GitHub, Scratch, Replit, Website…)</span>
        </label>
        <input name="project_link" type="url" required defaultValue={project?.project_url ?? ''} placeholder="https://…" className={cls} />
      </div>

      {/* Video URL */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Demo Video URL <span className="ml-1 font-normal text-[#94A3B8]">(YouTube only, optional)</span>
        </label>
        <input name="video_url" type="url" defaultValue={project?.video_url ?? ''} placeholder="https://youtube.com/watch?v=…" className={cls} />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || imageUploading || (!imageUrl && mode === 'create')}
          className="flex-1 rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
        >
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit Project'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
          >
            Cancel
          </button>
        )}
      </div>
      {mode === 'create' && !imageUrl && (
        <p className="text-xs text-[#F59E0B]">Please upload a cover image before submitting.</p>
      )}
    </form>
  )
}
