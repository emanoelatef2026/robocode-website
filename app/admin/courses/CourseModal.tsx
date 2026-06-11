'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCourse,
  updateCourse,
  deleteCourse,
  loadCourseForEdit,
} from '@/modules/courses/actions'
import type { Course } from '@/modules/courses/types'
import type { ActionResult } from '@/types/app'

interface Props {
  onClose:   () => void
  mode:      'create' | 'edit'
  courseId?: string
}

const cls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

// ── Inner components ─────────────────────────────────────────────────────────

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title:       string
  defaultOpen?: boolean
  children:    React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[#E2E8F0] last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between py-3.5 text-sm font-semibold text-[#0B1F3A] transition-colors hover:text-[#FF8A1F]"
      >
        {title}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-[#94A3B8] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {/* Keep all fields in DOM so form submission always includes them */}
      <div className={open ? 'space-y-3 pb-5' : 'hidden'}>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label:    string
  required?: boolean
  hint?:    string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-[#94A3B8]">{hint}</p>}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {[80, 60, 120, 60].map((w, i) => (
        <div key={i}>
          <div className={`mb-1.5 h-3 w-${w === 80 ? '20' : w === 60 ? '16' : '28'} rounded bg-[#E2E8F0]`} />
          <div className="h-9 rounded-lg bg-[#F1F5F9]" />
        </div>
      ))}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function CourseModal({ onClose, mode, courseId }: Props) {
  const router   = useRouter()
  const isDirty  = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const codeRef  = useRef<HTMLInputElement>(null)

  const [course,      setCourse]      = useState<Course | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  // Load full course data for edit mode
  useEffect(() => {
    if (mode !== 'edit' || !courseId) return
    setLoading(true)
    setLoadError(null)
    loadCourseForEdit(courseId).then(result => {
      if (result.success) {
        setCourse(result.data)
      } else {
        setLoadError(result.error.message)
      }
      setLoading(false)
    })
  }, [mode, courseId])

  // Action states — both must be declared unconditionally
  const [createState, createAction, createPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(createCourse, null)

  const [editState, editAction, editPending] = useActionState<
    ActionResult<void> | null,
    FormData
  >(updateCourse, null)

  const formAction = mode === 'create' ? createAction : editAction
  const pending    = mode === 'create' ? createPending : editPending
  const errorMsg   =
    (mode === 'create' && createState && !createState.success) ? createState.error.message :
    (mode === 'edit'   && editState   && !editState.success)   ? editState.error.message :
    null

  // Close on success
  useEffect(() => {
    if (createState?.success) { router.refresh(); isDirty.current = false; onClose() }
  }, [createState, router, onClose])

  useEffect(() => {
    if (editState?.success) { router.refresh(); isDirty.current = false; onClose() }
  }, [editState, router, onClose])

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    if (isDirty.current && !window.confirm('Discard unsaved changes?')) return
    isDirty.current = false
    onClose()
  }

  // Auto-suggest code from title
  const handleTitleBlur = () => {
    const title = titleRef.current?.value?.trim()
    if (title && codeRef.current && !codeRef.current.value) {
      codeRef.current.value = title
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(w => w.slice(0, 3))
        .join('-')
    }
  }

  const handleDelete = async () => {
    if (!course) return
    if (!window.confirm('Delete this course? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCourse(course.id)
    if (!result.success) {
      setDeleteError(result.error.message)
      setDeleting(false)
      return
    }
    isDirty.current = false
    router.refresh()
    onClose()
  }

  const title = mode === 'create' ? 'New Course' : loading ? 'Edit Course' : (course?.title ?? 'Edit Course')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">

        {/* ── Sticky header ── */}
        <div className="flex-none flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 id="cm-title" className="text-base font-semibold text-[#0B1F3A]">{title}</h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              {mode === 'create'
                ? 'Global asset — visible across all branches.'
                : 'Update course details, resources, and pedagogy.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <Skeleton />
          ) : loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}
            </div>
          ) : (
            <form
              id="course-form"
              action={formAction}
              onChange={() => { isDirty.current = true }}
            >
              {/* Hidden fields */}
              <input type="hidden" name="scope" value="global" />
              {mode === 'edit' && course && (
                <>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="resource_links" value={JSON.stringify(course.resource_links ?? [])} />
                </>
              )}

              {/* Error banner */}
              {errorMsg && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* ── Section 1: Basic Info ── */}
              <AccordionSection title="Basic Info" defaultOpen>
                <Field label="Course Name" required>
                  <input
                    ref={titleRef}
                    name="title"
                    required
                    autoFocus={mode === 'create'}
                    defaultValue={course?.title ?? ''}
                    onBlur={handleTitleBlur}
                    placeholder="e.g. Pictoblox Level 1"
                    className={cls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Code" hint="Auto-suggested from title if blank">
                    <input
                      ref={codeRef}
                      name="code"
                      defaultValue={course?.code ?? ''}
                      placeholder="e.g. PB1, RBC-ADV"
                      className={cls}
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      name="category"
                      defaultValue={course?.category ?? ''}
                      placeholder="e.g. Programming, Robotics"
                      className={cls}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={course?.description ?? ''}
                    placeholder="Brief overview of what students will learn…"
                    className={cls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Level">
                    <select name="level" defaultValue={course?.level ?? ''} className={cls}>
                      <option value="">— select —</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </Field>
                  <Field label="Est. Hours">
                    <input
                      name="estimated_hours"
                      type="number"
                      min={0}
                      defaultValue={course?.estimated_hours ?? ''}
                      className={cls}
                    />
                  </Field>
                </div>

                <Field label="Thumbnail URL">
                  <input
                    name="thumbnail_url"
                    type="url"
                    defaultValue={course?.thumbnail_url ?? ''}
                    placeholder="https://…/cover.jpg"
                    className={cls}
                  />
                </Field>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    id="cm-is-published"
                    name="is_published"
                    type="checkbox"
                    value="on"
                    defaultChecked={course?.is_published ?? false}
                    className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF8A1F]"
                  />
                  <label htmlFor="cm-is-published" className="cursor-pointer text-sm font-medium text-[#0B1F3A]">
                    Published
                  </label>
                  <span className="text-xs text-[#94A3B8]">— visible to students and groups</span>
                </div>
              </AccordionSection>

              {/* ── Section 2: Resource Center ── */}
              <AccordionSection title="Resource Center">
                <Field label="Main Content Link" hint="Primary resource: Google Drive, Notion, or course site">
                  <input
                    name="resources_url"
                    type="url"
                    defaultValue={course?.resources_url ?? ''}
                    placeholder="https://drive.google.com/… or Notion URL"
                    className={cls}
                  />
                </Field>
                <Field label="Google Drive Folder">
                  <input
                    name="drive_url"
                    type="url"
                    defaultValue={course?.drive_url ?? ''}
                    placeholder="https://drive.google.com/…"
                    className={cls}
                  />
                </Field>
                <Field label="Curriculum Folder">
                  <input
                    name="curriculum_folder"
                    type="url"
                    defaultValue={course?.curriculum_folder ?? ''}
                    placeholder="Link to curriculum or lesson plan folder"
                    className={cls}
                  />
                </Field>
                <Field label="Curriculum URL">
                  <input
                    name="curriculum_url"
                    type="url"
                    defaultValue={course?.curriculum_url ?? ''}
                    placeholder="https://…"
                    className={cls}
                  />
                </Field>
                <Field label="Homework Drive URL">
                  <input
                    name="homework_drive_url"
                    type="url"
                    defaultValue={course?.homework_drive_url ?? ''}
                    placeholder="https://drive.google.com/…"
                    className={cls}
                  />
                </Field>
                <Field label="Syllabus URL">
                  <input
                    name="syllabus_url"
                    type="url"
                    defaultValue={course?.syllabus_url ?? ''}
                    placeholder="https://…"
                    className={cls}
                  />
                </Field>
              </AccordionSection>

              {/* ── Section 3: Instructor Assets ── */}
              <AccordionSection title="Instructor Assets">
                <Field label="Session Plans">
                  <textarea
                    name="session_plans"
                    rows={3}
                    defaultValue={course?.session_plans ?? ''}
                    placeholder="How sessions are structured, duration, activities…"
                    className={cls}
                  />
                </Field>
                <Field label="Teaching Guide">
                  <textarea
                    name="teaching_guide"
                    rows={3}
                    defaultValue={course?.teaching_guide ?? ''}
                    placeholder="Methodologies, examples, classroom tips…"
                    className={cls}
                  />
                </Field>
                <Field label="Instructor Notes">
                  <textarea
                    name="instructor_notes"
                    rows={2}
                    defaultValue={course?.instructor_notes ?? ''}
                    placeholder="Notes and tips for instructors…"
                    className={cls}
                  />
                </Field>
                <Field label="Preparation Notes">
                  <textarea
                    name="preparation_notes"
                    rows={2}
                    defaultValue={course?.preparation_notes ?? ''}
                    placeholder="What to prepare before sessions…"
                    className={cls}
                  />
                </Field>
                <Field label="Meeting URL">
                  <input
                    name="meeting_url"
                    type="url"
                    defaultValue={course?.meeting_url ?? ''}
                    placeholder="https://meet.google.com/…"
                    className={cls}
                  />
                </Field>
              </AccordionSection>

              {/* ── Section 4: Pedagogy & Outcomes ── */}
              <AccordionSection title="Pedagogy & Outcomes">
                <Field label="Prerequisites">
                  <textarea
                    name="prerequisites"
                    rows={2}
                    defaultValue={course?.prerequisites ?? ''}
                    placeholder="What students should know before starting…"
                    className={cls}
                  />
                </Field>
                <Field label="Expected Outcomes">
                  <textarea
                    name="expected_outcomes"
                    rows={3}
                    defaultValue={course?.expected_outcomes ?? ''}
                    placeholder="What students will be able to do after completing this course…"
                    className={cls}
                  />
                </Field>
                <Field label="Skills Covered">
                  <input
                    name="skills_covered"
                    defaultValue={course?.skills_covered ?? ''}
                    placeholder="e.g. Python, Scratch, robotics, problem solving"
                    className={cls}
                  />
                </Field>
                <Field label="Course Roadmap">
                  <textarea
                    name="course_roadmap"
                    rows={3}
                    defaultValue={course?.course_roadmap ?? ''}
                    placeholder="Sequence of topics, milestones, progression path…"
                    className={cls}
                  />
                </Field>
              </AccordionSection>

              {/* ── Section 5: AI & Metadata ── */}
              <AccordionSection title="AI & Metadata">
                <Field label="AI Tools Used">
                  <input
                    name="ai_tools_used"
                    defaultValue={course?.ai_tools_used ?? ''}
                    placeholder="e.g. ChatGPT, Copilot, Pictoblox AI"
                    className={cls}
                  />
                </Field>
                <Field label="Recommended Age">
                  <input
                    name="recommended_age"
                    defaultValue={course?.recommended_age ?? ''}
                    placeholder="e.g. 8–12 years"
                    className={cls}
                  />
                </Field>
              </AccordionSection>

              {/* ── Danger zone (edit mode only) ── */}
              {mode === 'edit' && course && (
                <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="mb-1 text-sm font-semibold text-red-700">Danger Zone</p>
                  <p className="mb-3 text-xs text-red-600">
                    Soft-deletes this course and removes it from all views.
                  </p>
                  {deleteError && (
                    <p className="mb-2 text-xs font-medium text-red-700">{deleteError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete course'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* ── Sticky footer ── */}
        {!loading && !loadError && (
          <div className="flex-none flex items-center justify-end gap-3 border-t border-[#E2E8F0] px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="course-form"
              disabled={pending || (mode === 'edit' && !course)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:opacity-60"
            >
              {pending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {mode === 'create' ? 'Creating…' : 'Saving…'}
                </>
              ) : mode === 'create' ? 'Create Course' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
