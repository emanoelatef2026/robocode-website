'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  IssueCertificateSchema,
  RevokeCertificateSchema,
} from './schemas'
import { generateCertificateCode } from './queries'
import { checkCertificateEligibility } from '@/modules/progress/eligibility'
import type { ActionResult } from '@/types/app'

// ─── Templates ────────────────────────────────────────────────────────────────

export async function createTemplate(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_certificates')

  const raw = {
    name:                 formData.get('name'),
    certificate_type:     formData.get('certificate_type'),
    description:          formData.get('description') || undefined,
    background_color:     formData.get('background_color') || '#FFFFFF',
    accent_color:         formData.get('accent_color') || '#FF8A1F',
    background_image_url: formData.get('background_image_url') || undefined,
    logo_url:             formData.get('logo_url') || undefined,
    stem_logo_url:        formData.get('stem_logo_url') || undefined,
    signature_url:        formData.get('signature_url') || undefined,
    signatory_name:       formData.get('signatory_name') || undefined,
    signatory_title:      formData.get('signatory_title') || undefined,
    branch_id:            formData.get('branch_id') || undefined,
    is_active:            formData.get('is_active') !== 'false',
  }

  const parsed = CreateTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('certificate_templates')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create template' } }

  revalidatePath('/admin/certificates/templates')
  return { success: true, data: { id: (data as any).id } }
}

export async function updateTemplate(
  templateId: string,
  input: unknown
): Promise<ActionResult<void>> {
  await requirePermission('manage_certificates')

  const parsed = UpdateTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { error } = await db
    .from('certificate_templates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/admin/certificates/templates')
  return { success: true, data: undefined }
}

// ─── Issue certificate ────────────────────────────────────────────────────────

export async function issueCertificate(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string; certificate_code: string }>> {
  const user = await requirePermission('manage_certificates')

  const studentId = formData.get('student_id') as string

  // Parse projects JSON submitted by the client-side project manager
  let projects: { title: string; sort_order: number }[] = []
  const projectsRaw = formData.get('projects')
  if (typeof projectsRaw === 'string' && projectsRaw.trim()) {
    try { projects = JSON.parse(projectsRaw) } catch { /* invalid JSON → empty list */ }
  }

  const raw = {
    student_id:       studentId,
    template_id:      formData.get('template_id') || undefined,
    certificate_type: formData.get('certificate_type'),
    title:            formData.get('title'),
    description:      formData.get('description') || undefined,
    projects,
    semester_id:      formData.get('semester_id') || undefined,
    course_id:        formData.get('course_id') || undefined,
    achievement_id:   formData.get('achievement_id') || undefined,
    valid_until:      formData.get('valid_until') || undefined,
    branch_id:        formData.get('branch_id') || undefined,
  }

  const parsed = IssueCertificateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  // Verify branch ownership before issuance
  const { data: studentBranch } = await db
    .from('students').select('branch_id').eq('id', d.student_id).single()
  if (!studentBranch) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  if (!isBranchAccessible(user, (studentBranch as any).branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this student\'s branch.' } }
  }

  // Fetch student name for recipient_name
  const { data: studentRow } = await db
    .from('students')
    .select('users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', d.student_id)
    .single()

  const s = studentRow as any
  const profile = s?.users?.profiles
  const recipientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || s?.users?.email || '—'

  // Run eligibility check before issuance when the certificate is semester-scoped
  const eligibility = d.semester_id
    ? await checkCertificateEligibility(d.student_id, d.semester_id)
    : null

  // Generate unique code (retry up to 5 times on collision)
  let code = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCertificateCode()
    const { data: existing } = await db
      .from('certificates')
      .select('id')
      .eq('certificate_code', candidate)
      .maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return { success: false, error: { code: 'INTERNAL', message: 'Could not generate unique certificate code' } }

  // Insert certificate
  const { data, error } = await db
    .from('certificates')
    .insert({
      certificate_code: code,
      template_id:      d.template_id ?? null,
      student_id:       d.student_id,
      certificate_type: d.certificate_type,
      title:            d.title,
      description:      d.description ?? null,
      recipient_name:   recipientName,
      projects:         d.projects ?? [],
      semester_id:      d.semester_id ?? null,
      course_id:        d.course_id ?? null,
      achievement_id:   d.achievement_id ?? null,
      valid_until:      d.valid_until ?? null,
      branch_id:        d.branch_id ?? null,
      issued_by:        user.id,
    })
    .select('id, certificate_code')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to issue certificate' } }

  const row = data as any

  // Insert eligibility snapshot — if this fails, compensate by deleting the certificate
  if (eligibility) {
    const now = new Date().toISOString()
    const { error: snapError } = await db
      .from('certificate_snapshots')
      .insert({
        certificate_id:       row.id,
        attendance_score:     eligibility.attendance_score,
        assignment_score:     eligibility.assignment_score,
        portfolio_score:      eligibility.portfolio_score,
        overall_score:        eligibility.overall_percentage,
        courses_evaluated:    eligibility.courses_evaluated,
        threshold_attendance: eligibility.thresholds.min_attendance,
        threshold_assignment: eligibility.thresholds.min_assignment,
        threshold_overall:    eligibility.thresholds.min_overall,
        is_eligible:          eligibility.is_eligible,
        eligibility_detail:   { failed_thresholds: eligibility.failed_thresholds },
        calculated_at:        now,
        issued_at:            now,
      })

    if (snapError) {
      await db.from('certificates').delete().eq('id', row.id)
      return { success: false, error: { code: 'DB_ERROR', message: 'Failed to record eligibility snapshot; certificate was not issued.' } }
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'issue_certificate',
    p_entity_type:  'certificate',
    p_entity_id:    row.id,
    p_new_values:   { certificate_code: row.certificate_code, student_id: d.student_id },
  })

  revalidatePath('/admin/certificates')
  return { success: true, data: { id: row.id, certificate_code: row.certificate_code } }
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

export async function revokeCertificate(
  certificateId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_certificates')

  const parsed = RevokeCertificateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()

  // Verify branch ownership: resolve certificate → student → branch
  const { data: certRow } = await db
    .from('certificates').select('student_id').eq('id', certificateId).single()
  if (!certRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Certificate not found.' } }
  const { data: certStudentRow } = await db
    .from('students').select('branch_id').eq('id', (certRow as any).student_id).single()
  if (certStudentRow && !isBranchAccessible(user, (certStudentRow as any).branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this certificate.' } }
  }

  const { error } = await db
    .from('certificates')
    .update({
      status:        'revoked',
      revoked_at:    new Date().toISOString(),
      revoked_by:    user.id,
      revoke_reason: parsed.data.revoke_reason,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', certificateId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'revoke_certificate',
    p_entity_type:  'certificate',
    p_entity_id:    certificateId,
    p_new_values:   { revoke_reason: parsed.data.revoke_reason },
  })

  revalidatePath('/admin/certificates')
  return { success: true, data: undefined }
}

// ─── Reinstate ────────────────────────────────────────────────────────────────

export async function reinstateCertificate(certificateId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_certificates')
  const db   = createServiceClient()

  const { error } = await db
    .from('certificates')
    .update({
      status:        'active',
      revoked_at:    null,
      revoked_by:    null,
      revoke_reason: null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', certificateId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/admin/certificates')
  return { success: true, data: undefined }
}
