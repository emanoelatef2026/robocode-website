'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import IssueCertificateForm from './new/IssueCertificateForm'
import type { CertificateTemplate } from '@/modules/certificates/types'

interface StudentOption  { id: string; name: string; email: string }
interface SemesterOption { id: string; name: string }
interface CourseOption   { id: string; title: string }

interface Props {
  templates:        CertificateTemplate[]
  students:         StudentOption[]
  semesters:        SemesterOption[]
  courses:          CourseOption[]
  triggerLabel?:    string
  triggerClassName?: string
  successRedirect?: string   // e.g. '/portal/team-leader/certificates' — if set, navigate there after success
}

export default function IssueCertificateModal({
  templates,
  students,
  semesters,
  courses,
  triggerLabel    = 'Issue Certificate',
  triggerClassName,
  successRedirect,
}: Props) {
  const router      = useRouter()
  const [open, setOpen] = useState(false)

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleSuccess(id: string) {
    setOpen(false)
    if (successRedirect) {
      router.push(`${successRedirect}/${id}`)
    } else {
      router.refresh()
    }
  }

  const defaultTriggerClass =
    'inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]'

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? defaultTriggerClass}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        {triggerLabel}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">Issue Certificate</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Fill in the details below and add projects before issuing</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Form body */}
            <div className="p-6">
              <IssueCertificateForm
                templates={templates}
                students={students}
                semesters={semesters}
                courses={courses}
                onSuccess={handleSuccess}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
