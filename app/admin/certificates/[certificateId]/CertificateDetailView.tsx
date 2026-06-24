'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { revokeCertificate, reinstateCertificate, deleteCertificate } from '@/modules/certificates/actions'
import type { CertificateDetail } from '@/modules/certificates/types'

interface Props {
  certificate: CertificateDetail
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course Completion',
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
  const [showDelete, setShowDelete]     = useState(false)
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

  async function handleDelete() {
    start(async () => {
      const result = await deleteCertificate(certificate.id)
      if (result.success) {
        router.push('/admin/certificates')
      } else {
        setError(result.error.message)
        setShowDelete(false)
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
        <div className="rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">{error}</div>
      )}

      {/* Status banner */}
      {isRevoked && (
        <div className="rounded-lg bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-sm text-[#DC2626]">
          <strong>Revoked</strong>
          {certificate.revoke_reason && ` — ${certificate.revoke_reason}`}
          {certificate.revoked_at && ` (${new Date(certificate.revoked_at).toLocaleDateString('en-GB')})`}
        </div>
      )}

      {/* Main details */}
      <div className="ds-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Certificate Code">
            <span className="font-mono text-sm font-bold text-[#FF8A1F]">{certificate.certificate_code}</span>
          </Field>
          <Field label="Status">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              isRevoked ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#E7F8EE] text-[#15803D]'
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
          {certificate.semester_name && <Field label="Learning Period">{certificate.semester_name}</Field>}
          {certificate.achievement_title && <Field label="Achievement">{certificate.achievement_title}</Field>}
        </div>

        {certificate.description && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8] mb-1">Description</p>
            <p className="text-sm text-[#475569]">{certificate.description}</p>
          </div>
        )}

        {certificate.projects && certificate.projects.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8] mb-2">
              Projects Completed ({certificate.projects.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {certificate.projects
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((p, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[#FF8A1F] bg-[#FFF7ED] px-3 py-1 text-xs font-medium text-[#FF8A1F]"
                  >
                    {p.title}
                  </span>
                ))}
            </div>
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-medium text-white hover:bg-[#059669] disabled:opacity-50"
          >
            Reinstate
          </button>
        ) : (
          <button
            onClick={() => setShowRevoke(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#DC2626]"
          >
            Revoke
          </button>
        )}

        <button
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] px-4 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#FEE2E2] ml-auto"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete Permanently
        </button>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#DC2626]">Delete this certificate permanently?</p>
          <p className="text-xs text-[#EF4444]">
            This action cannot be undone. The certificate record, code <strong>{certificate.certificate_code}</strong>, and all related data will be permanently removed.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-[#B91C1C] disabled:opacity-50"
            >
              {isPending ? 'Deleting…' : 'Yes, Delete Permanently'}
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Revoke dialog */}
      {showRevoke && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4 space-y-3">
          <p className="text-sm font-medium text-[#DC2626]">Enter a reason for revoking this certificate:</p>
          <textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={2}
            placeholder="e.g. Issued in error, student did not complete requirements…"
            className="w-full rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#F87171] focus:ring-2 focus:ring-red-400/15"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRevoke}
              disabled={isPending || !revokeReason.trim()}
              className="rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#DC2626] disabled:opacity-50"
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
