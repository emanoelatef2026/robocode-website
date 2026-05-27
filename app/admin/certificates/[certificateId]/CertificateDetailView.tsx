'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { revokeCertificate, reinstateCertificate } from '@/modules/certificates/actions'
import type { CertificateDetail } from '@/modules/certificates/types'

interface Props {
  certificate: CertificateDetail
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Semester Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Custom',
}

export default function CertificateDetailView({ certificate }: Props) {
  const router              = useRouter()
  const [isPending, start]  = useTransition()
  const [revokeReason, setRevokeReason] = useState('')
  const [showRevoke, setShowRevoke]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  async function handleRevoke() {
    if (!revokeReason.trim()) return
    start(async () => {
      const result = await revokeCertificate(certificate.id, { revoke_reason: revokeReason })
      if (result.success) {
        router.refresh()
        setShowRevoke(false)
      } else {
        setError(result.error.message)
      }
    })
  }

  async function handleReinstate() {
    start(async () => {
      const result = await reinstateCertificate(certificate.id)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })
  }

  const isRevoked = certificate.status === 'revoked'

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Status banner */}
      {isRevoked && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>Revoked</strong>
          {certificate.revoke_reason && ` — ${certificate.revoke_reason}`}
          {certificate.revoked_at && ` (${new Date(certificate.revoked_at).toLocaleDateString('en-GB')})`}
        </div>
      )}

      {/* Main details */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Certificate Code">
            <span className="font-mono text-sm font-bold text-[#FF8A1F]">{certificate.certificate_code}</span>
          </Field>
          <Field label="Status">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              isRevoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {isRevoked ? 'Revoked' : 'Active'}
            </span>
          </Field>
          <Field label="Recipient">{certificate.recipient_name}</Field>
          <Field label="Student email">{certificate.student_email}</Field>
          <Field label="Type">{TYPE_LABELS[certificate.certificate_type] ?? certificate.certificate_type}</Field>
          <Field label="Template">{certificate.template?.name ?? '—'}</Field>
          <Field label="Issued">{new Date(certificate.issued_at).toLocaleDateString('en-GB')}</Field>
          <Field label="Valid Until">
            {certificate.valid_until
              ? new Date(certificate.valid_until).toLocaleDateString('en-GB')
              : 'No expiry'}
          </Field>
          {certificate.course_title && <Field label="Course">{certificate.course_title}</Field>}
          {certificate.semester_name && <Field label="Semester">{certificate.semester_name}</Field>}
          {certificate.achievement_title && <Field label="Achievement">{certificate.achievement_title}</Field>}
        </div>

        {certificate.description && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8] mb-1">Description</p>
            <p className="text-sm text-[#475569]">{certificate.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/api/certificates/${certificate.certificate_code}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download PDF
        </a>

        <a
          href={`/verify/${certificate.certificate_code}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
        >
          Verify Page ↗
        </a>

        {isRevoked ? (
          <button
            onClick={handleReinstate}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
          >
            Reinstate
          </button>
        ) : (
          <button
            onClick={() => setShowRevoke(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Revoke
          </button>
        )}
      </div>

      {/* Revoke dialog */}
      {showRevoke && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-700">Enter a reason for revoking this certificate:</p>
          <textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={2}
            placeholder="e.g. Issued in error, student did not complete requirements…"
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/15"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRevoke}
              disabled={isPending || !revokeReason.trim()}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isPending ? 'Revoking…' : 'Confirm Revoke'}
            </button>
            <button
              onClick={() => { setShowRevoke(false); setRevokeReason('') }}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8] mb-1">{label}</p>
      <p className="text-sm text-[#0B1F3A]">{children}</p>
    </div>
  )
}
