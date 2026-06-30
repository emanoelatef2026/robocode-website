'use client'

import { useActionState, useState, useRef, useTransition, useEffect } from 'react'
import { issueCertificate, loadStudentPortfolioProjects } from '@/modules/certificates/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/types/app'
import type { CertificateTemplate } from '@/modules/certificates/types'

interface StudentOption   { id: string; name: string; email: string }
interface SemesterOption  { id: string; name: string }
interface CourseOption    { id: string; title: string }
interface Project         { title: string; sort_order: number }
interface PortfolioProject { id: string; title: string; course_title: string | null }

interface Props {
  templates:  CertificateTemplate[]
  students:   StudentOption[]
  semesters:  SemesterOption[]
  courses:    CourseOption[]
  onSuccess?: (id: string, code: string) => void
  onCancel?:  () => void
}

const MAX_PROJECTS = 20

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Semester Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

export default function IssueCertificateForm({ templates, students, semesters, courses, onSuccess, onCancel }: Props) {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult<{ id: string; certificate_code: string }> | null, FormData>(
    async (prev, formData) => {
      const result = await issueCertificate(prev, formData)
      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data.id, result.data.certificate_code)
        } else {
          router.push(`/admin/certificates/${result.data.id}`)
        }
      }
      return result
    },
    null
  )

  // ── Student & course state ──────────────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedCourseId,  setSelectedCourseId]  = useState('')
  const [courseNameField,   setCourseNameField]   = useState('')

  // ── Portfolio project loader ────────────────────────────────────────────────
  const [portfolioProjects,    setPortfolioProjects]    = useState<PortfolioProject[]>([])
  const [isLoadingPortfolio,   setIsLoadingPortfolio]   = useState(false)
  const [checkedPortfolioIds,  setCheckedPortfolioIds]  = useState<Set<string>>(new Set())
  const [, startPortfolioLoad] = useTransition()

  useEffect(() => {
    if (!selectedStudentId) {
      setPortfolioProjects([])
      setCheckedPortfolioIds(new Set())
      return
    }
    setIsLoadingPortfolio(true)
    startPortfolioLoad(async () => {
      const result = await loadStudentPortfolioProjects(selectedStudentId)
      if (result.success) {
        setPortfolioProjects(result.data)
        // Auto-check all projects by default
        setCheckedPortfolioIds(new Set(result.data.map((p) => p.id)))
      }
      setIsLoadingPortfolio(false)
    })
  }, [selectedStudentId])

  // ── Project manager state ───────────────────────────────────────────────────
  const [projects, setProjects]     = useState<Project[]>([])
  const [newTitle,  setNewTitle]    = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Merge portfolio selection into the projects list whenever selection changes
  useEffect(() => {
    const selected = portfolioProjects
      .filter((p) => checkedPortfolioIds.has(p.id))
      .map((p, i) => ({ title: p.title, sort_order: i }))
    setProjects(selected)
  }, [checkedPortfolioIds, portfolioProjects])

  function togglePortfolioProject(id: string) {
    setCheckedPortfolioIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addProject() {
    const t = newTitle.trim()
    if (!t) return

    if (projects.length >= MAX_PROJECTS) {
      setProjectError(`Maximum ${MAX_PROJECTS} projects allowed.`)
      return
    }
    const isDuplicate = projects.some((p) => p.title.toLowerCase() === t.toLowerCase())
    if (isDuplicate) {
      setProjectError('A project with that name already exists.')
      return
    }
    setProjectError(null)
    setProjects((prev) => [...prev, { title: t, sort_order: prev.length }])
    setNewTitle('')
    addInputRef.current?.focus()
  }

  function removeProject(idx: number) {
    setProjectError(null)
    setProjects((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sort_order: i })))
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditTitle(projects[idx].title)
  }

  function saveEdit() {
    if (editingIdx === null) return
    const t = editTitle.trim()
    if (!t) { setEditingIdx(null); return }
    const isDuplicate = projects.some((p, i) => i !== editingIdx && p.title.toLowerCase() === t.toLowerCase())
    if (isDuplicate) {
      setProjectError('A project with that name already exists.')
      return
    }
    setProjectError(null)
    setProjects((prev) => prev.map((p, i) => i === editingIdx ? { ...p, title: t } : p))
    setEditingIdx(null)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setProjects((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((p, i) => ({ ...p, sort_order: i }))
    })
  }

  function moveDown(idx: number) {
    setProjects((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((p, i) => ({ ...p, sort_order: i }))
    })
  }

  function handleCourseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setSelectedCourseId(id)
    const course = courses.find((c) => c.id === id)
    if (course) {
      setCourseNameField(course.title)
    }
  }

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Hidden field carries projects JSON to the server action */}
        <input type="hidden" name="projects" value={JSON.stringify(projects)} />

        {/* Student */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Student <span className="text-[#EF4444]">*</span>
          </label>
          <select
            name="student_id"
            required
            className={inputClass}
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>

        {/* Portfolio projects — auto-loaded when student is selected */}
        {(selectedStudentId || isLoadingPortfolio) && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3 bg-[#F8FAFC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">Portfolio Projects</p>
                <p className="text-xs text-[#94A3B8]">
                  {isLoadingPortfolio
                    ? 'Loading from portfolio…'
                    : portfolioProjects.length > 0
                      ? 'Select which projects to include on the certificate'
                      : 'No portfolio projects found for this student'}
                </p>
              </div>
              {portfolioProjects.length > 0 && (
                <span className="rounded-full bg-[#29b5e6]/10 px-2 py-0.5 text-xs font-medium text-[#29b5e6]">
                  {checkedPortfolioIds.size}/{portfolioProjects.length} selected
                </span>
              )}
            </div>

            {isLoadingPortfolio && (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 flex-1 animate-pulse rounded-lg bg-[#E2E8F0]" />
                ))}
              </div>
            )}

            {!isLoadingPortfolio && portfolioProjects.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {portfolioProjects.map((p) => {
                  const checked = checkedPortfolioIds.has(p.id)
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
                        checked
                          ? 'border-[#FF8A1F] bg-[#FFF7ED]'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#FF8A1F]"
                        checked={checked}
                        onChange={() => togglePortfolioProject(p.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-[#0B1F3A] leading-tight">{p.title}</span>
                        {p.course_title && (
                          <span className="block text-[10px] text-[#94A3B8] truncate">{p.course_title}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-[#EF4444]">*</span>
            </label>
            <select name="certificate_type" required className={inputClass}>
              {CERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {/* Template */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Template</label>
            <select name="template_id" className={inputClass}>
              <option value="">— no template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Course Name (title field — immutable snapshot stored at issuance) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Course Name <span className="text-[#EF4444]">*</span>
          </label>
          <input
            name="title"
            required
            value={courseNameField}
            onChange={(e) => setCourseNameField(e.target.value)}
            placeholder="e.g. Pictoblox Coding, Python Programming, Arduino & Robotics…"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            Displayed prominently on the certificate. Auto-filled when you select a course below — editable.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Additional context (optional, not shown on certificate)…"
            className={inputClass}
          />
        </div>

        {/* ── Manual project manager ───────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">Project List</p>
              <p className="text-xs text-[#94A3B8]">
                {portfolioProjects.length > 0
                  ? 'Projects from portfolio are pre-selected above. Add extra ones here or reorder.'
                  : 'Add all projects the student built during this course'}
              </p>
            </div>
            {projects.length > 0 && (
              <span className="rounded-full bg-[#FF8A1F]/10 px-2 py-0.5 text-xs font-medium text-[#FF8A1F]">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {projectError && (
            <p className="text-xs text-[#EF4444]">{projectError}</p>
          )}

          {/* Project list */}
          {projects.length > 0 && (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {projects.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="text-[#CBD5E1] hover:text-[#64748B] disabled:opacity-30 leading-none"
                      aria-label="Move up"
                    >▲</button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === projects.length - 1}
                      className="text-[#CBD5E1] hover:text-[#64748B] disabled:opacity-30 leading-none"
                      aria-label="Move down"
                    >▼</button>
                  </div>

                  <span className="w-5 shrink-0 text-center text-[10px] text-[#CBD5E1] font-mono">{i + 1}</span>

                  {/* Title or edit input */}
                  {editingIdx === i ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
                        if (e.key === 'Escape') setEditingIdx(null)
                      }}
                      className="flex-1 rounded border border-[#FF8A1F] bg-white px-2 py-1 text-sm text-[#0B1F3A] outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-[#0B1F3A]">{p.title}</span>
                  )}

                  {editingIdx === i ? (
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="shrink-0 text-xs font-medium text-[#FF8A1F] hover:text-[#e87c18]"
                    >Save</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      className="shrink-0 text-xs text-[#64748B] hover:text-[#0B1F3A]"
                    >Edit</button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProject(i)}
                    className="shrink-0 text-xs text-[#F87171] hover:text-[#EF4444]"
                    aria-label="Remove project"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}

          {/* Add project input — shown when student has no portfolio or for extras */}
          {projects.length < MAX_PROJECTS && (
            <div className="flex gap-2">
              <input
                ref={addInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProject() } }}
                placeholder="Add extra project name…"
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
              <button
                type="button"
                onClick={addProject}
                disabled={!newTitle.trim()}
                className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40 transition"
              >+ Add</button>
            </div>
          )}

          {projects.length >= MAX_PROJECTS && (
            <p className="text-xs text-[#94A3B8]">Maximum of {MAX_PROJECTS} projects reached.</p>
          )}
        </div>
        {/* ────────────────────────────────────────────────────────────────── */}

        <div className="grid grid-cols-2 gap-4">
          {/* Course */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Course (optional)</label>
            <select
              name="course_id"
              className={inputClass}
              value={selectedCourseId}
              onChange={handleCourseChange}
            >
              <option value="">— none —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          {/* Semester */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Semester (optional)</label>
            <select name="semester_id" className={inputClass}>
              <option value="">— none —</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Valid until */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Valid Until (optional)</label>
          <input name="valid_until" type="datetime-local" className={inputClass} />
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          {onCancel ? (
            <button type="button" onClick={onCancel} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
              Cancel
            </button>
          ) : (
            <Link href="/admin/certificates" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
              Cancel
            </Link>
          )}
          <SubmitButton label="Issue Certificate" pendingLabel="Issuing…" />
        </div>
      </form>
    </div>
  )
}
