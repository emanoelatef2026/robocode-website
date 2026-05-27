import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb, createSuccessMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks (hoisted before imports) ──────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-1', role: 'instructor' }),
}))

vi.mock('@/modules/progress/eligibility', () => ({
  checkCertificateEligibility: vi.fn(),
}))

// ── Imports (after mocks are hoisted) ────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { checkCertificateEligibility } from '@/modules/progress/eligibility'
import { issueCertificate }    from '@/modules/certificates/actions'
import { getCertificateSnapshot } from '@/modules/certificates/queries'

// ── Shared fixtures ───────────────────────────────────────────────────────────

// RFC 4122 v4 UUIDs — required by Zod v4's strict uuid()
const STUDENT_UUID  = '00000000-0000-4000-8000-000000000001'
const SEMESTER_UUID = '00000000-0000-4000-8000-000000000002'
const CERT_UUID     = '00000000-0000-4000-8000-000000000003'

const fakeEligibility = {
  student_id:         STUDENT_UUID,
  semester_id:        SEMESTER_UUID,
  is_eligible:        true,
  overall_percentage: 85,
  attendance_score:   90,
  assignment_score:   80,
  portfolio_score:    75,
  courses_evaluated:  2,
  failed_thresholds:  [],
  thresholds:         { min_attendance: 75, min_assignment: 60, min_overall: 70 },
}

const fakeSnapshot = {
  id:                   CERT_UUID,
  certificate_id:       CERT_UUID,
  attendance_score:     90,
  assignment_score:     80,
  portfolio_score:      75,
  overall_score:        85,
  courses_evaluated:    2,
  threshold_attendance: 75,
  threshold_assignment: 60,
  threshold_overall:    70,
  is_eligible:          true,
  eligibility_detail:   null,
  calculated_at:        '2026-05-27T00:00:00Z',
  issued_at:            '2026-05-27T00:00:00Z',
}

function makeIssueDb(snapshotResult: MockResult = { data: { id: CERT_UUID }, error: null }) {
  return createMockDb({
    students: [{ data: { users: { email: 'student@test.com', profiles: null } }, error: null }],
    certificates: [
      { data: null, error: null },  // code collision check → no collision
      { data: { id: CERT_UUID, certificate_code: 'RBC-2026-TESTXX' }, error: null },  // insert
    ],
    certificate_snapshots: [snapshotResult],
  })
}

function issueFormData(withSemester = true) {
  const fd = new FormData()
  fd.set('student_id',       STUDENT_UUID)
  fd.set('certificate_type', 'semester_completion')
  fd.set('title',            'Test Certificate')
  if (withSemester) fd.set('semester_id', SEMESTER_UUID)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', role: 'instructor' } as any)
  vi.mocked(checkCertificateEligibility).mockResolvedValue(fakeEligibility as any)
  vi.mocked(createServiceClient).mockReturnValue(createSuccessMockDb() as any)
})

// ── getCertificateSnapshot ────────────────────────────────────────────────────

describe('getCertificateSnapshot', () => {
  it('returns null when no snapshot exists for the certificate', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({ certificate_snapshots: [{ data: null, error: null }] }) as any
    )
    const result = await getCertificateSnapshot(CERT_UUID)
    expect(result).toBeNull()
  })

  it('returns null when the query errors', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        certificate_snapshots: [{ data: null, error: { message: 'not found', code: 'PGRST116' } }],
      }) as any
    )
    const result = await getCertificateSnapshot(CERT_UUID)
    expect(result).toBeNull()
  })

  it('returns the snapshot when it exists', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({ certificate_snapshots: [{ data: fakeSnapshot, error: null }] }) as any
    )
    const result = await getCertificateSnapshot(CERT_UUID)
    expect(result).toEqual(fakeSnapshot)
  })
})

// ── issueCertificate snapshot behavior ───────────────────────────────────────

describe('issueCertificate snapshot behavior', () => {
  it('calls checkCertificateEligibility and inserts a snapshot when semester_id is present', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeIssueDb() as any)

    const result = await issueCertificate(undefined, issueFormData(true))

    expect(result.success).toBe(true)
    expect(checkCertificateEligibility).toHaveBeenCalledOnce()
    expect(checkCertificateEligibility).toHaveBeenCalledWith(STUDENT_UUID, SEMESTER_UUID)
  })

  it('does not call checkCertificateEligibility when no semester_id is provided', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeIssueDb() as any)

    const result = await issueCertificate(undefined, issueFormData(false))

    expect(result.success).toBe(true)
    expect(checkCertificateEligibility).not.toHaveBeenCalled()
  })

  it('succeeds even when student is not eligible — snapshot records the ineligibility', async () => {
    vi.mocked(checkCertificateEligibility).mockResolvedValue({
      ...fakeEligibility,
      is_eligible:       false,
      failed_thresholds: ['attendance'],
    } as any)
    vi.mocked(createServiceClient).mockReturnValue(makeIssueDb() as any)

    const result = await issueCertificate(undefined, issueFormData(true))

    expect(result.success).toBe(true)
  })

  it('rolls back (compensating delete) when snapshot insert fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeIssueDb({ data: null, error: { message: 'constraint violation', code: '23505' } }) as any
    )

    const result = await issueCertificate(undefined, issueFormData(true))

    expect(result.success).toBe(false)
    expect((result as any).error.code).toBe('DB_ERROR')
    expect((result as any).error.message).toMatch(/snapshot/)
  })

  it('returns DB_ERROR when the certificate insert itself fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        students:     [{ data: { users: { email: 'test@test.com', profiles: null } }, error: null }],
        certificates: [
          { data: null, error: null },  // code check
          { data: null, error: { message: 'insert failed', code: 'PGRST' } },  // insert fails
        ],
      }) as any
    )

    const result = await issueCertificate(undefined, issueFormData(true))

    expect(result.success).toBe(false)
    expect(checkCertificateEligibility).toHaveBeenCalled()  // eligibility runs before insert
  })
})
