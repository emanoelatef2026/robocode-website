'use client'

import { useActionState } from 'react'
import { issueCertificate } from '@/modules/certificates/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/types/app'
import type { CertificateTemplate } from '@/modules/certificates/types'

interface StudentOption   { id: string; name: string; email: string }
interface SemesterOption  { id: string; name: string }
interface CourseOption    { id: string; title: string }

interface Props {
  templates: CertificateTemplate[]
  students:  StudentOption[]
  semesters: SemesterOption[]
  courses:   CourseOption[]
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Course Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

export default function IssueCertificateForm({ templates, students, semesters, courses }: Props) {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult<{ id: string; certificate_code: string }> | null, FormData>(
    async (prev, formData) => {
      const result = await issueCertificate(prev, formData)
      if (result.success) {
        router.push(`/admin/certificates/${result.data.id}`)
      }
      return result
    },
    null
  )

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Student */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Student <span className="text-red-500">*</span>
          </label>
          <select name="student_id" required className={inputClass}>
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-red-500">*</span>
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

        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Certificate Title <span className="text-red-500">*</span>
          </label>
          <input name="title" required placeholder="e.g. Introduction to Robotics — Semester 1 Completion" className={inputClass} />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={2} placeholder="Additional context shown on the certificate…" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Course */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Course (optional)</label>
            <select name="course_id" className={inputClass}>
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
          <Link href="/admin/certificates" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            Cancel
          </Link>
          <SubmitButton label="Issue Certificate" pendingLabel="Issuing…" />
        </div>
      </form>
    </div>
  )
}
