'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { generateCertificateCode, listActiveTemplates } from './queries'
import { awardXP, XP_AWARDS } from '@/modules/gamification/xp-service'
import { checkAndUnlockAchievements, checkCourseAchievement } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import type { ActionResult } from '@/types/app'
import type { CertificateTemplate } from './types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BulkWizardOptions {
  templates: CertificateTemplate[]
  semesters: { id: string; name: string }[]
  courses:   { id: string; title: string }[]
}

export interface BulkPreviewStudent {
  student_id:    string
  student_name:  string
  /** ready = will receive certificate; already_issued = will be skipped */
  status:        'ready' | 'already_issued'
  project_count: number
  has_portfolio: boolean
  projects:      { title: string; sort_order: number }[]
}

export interface BulkIssueInput {
  group_id:          string
  branch_id:         string
  student_ids:       string[]
  course_id:         string | null
  semester_id:       string | null
  certificate_type:  string
  title:             string
  template_id:       string | null
  project_mode:      'same' | 'portfolio'
  shared_projects:   { title: string; sort_order: number }[]
}

export interface BulkIssueResult {
  created:  number
  skipped:  number
  failed:   number
  batch_id: string
}

// ─── Load wizard options ────────────────────────────────────────────────────────

export async function loadBulkCertificateWizardOptions(): Promise<ActionResult<BulkWizardOptions>> {
  await requirePermission('manage_certificates')

  const db = createServiceClient()

  const [templates, semRes, courseRes] = await Promise.all([
    listActiveTemplates(),
    db.from('semesters').select('id, name').order('name', { ascending: false }).limit(20),
    db.from('courses').select('id, title').order('title').limit(100),
  ])

  return {
    success: true,
    data: {
      templates,
      semesters: (semRes.data ?? []) as { id: string; name: string }[],
      courses:   (courseRes.data ?? []) as { id: string; title: string }[],
    },
  }
}

// ─── Load preview data ─────────────────────────────────────────────────────────
// Called from the client when entering Step 3. Checks existing certs and
// batch-loads portfolio projects so every student row is immediately renderable.

export async function loadBulkPreviewData(input: {
  student_ids:    string[]
  course_id:      string | null
  semester_id:    string | null
  project_mode:   'same' | 'portfolio'
  shared_projects: { title: string; sort_order: number }[]
  students_meta:   { student_id: string; student_name: string }[]
}): Promise<ActionResult<BulkPreviewStudent[]>> {
  await requirePermission('manage_certificates')

  const { student_ids, course_id, semester_id, project_mode, shared_projects, students_meta } = input

  if (!student_ids.length) return { success: true, data: [] }

  const db = createServiceClient()

  // 1. Find existing active certificates for these students + course + semester
  let existingQuery = db
    .from('certificates')
    .select('student_id')
    .in('student_id', student_ids)
    .neq('status', 'revoked')

  if (course_id) existingQuery = existingQuery.eq('course_id', course_id)
  else           existingQuery = existingQuery.is('course_id', null)

  if (semester_id) existingQuery = existingQuery.eq('semester_id', semester_id)
  else             existingQuery = existingQuery.is('semester_id', null)

  const { data: existingRows } = await existingQuery
  const issuedSet = new Set((existingRows ?? []).map((r: any) => r.student_id as string))

  // 2. If portfolio mode: batch-load all portfolio projects for these students
  const portfolioMap = new Map<string, { title: string; sort_order: number }[]>()

  if (project_mode === 'portfolio') {
    const { data: portfolioRows } = await db
      .from('student_portfolios')
      .select('id, student_id')
      .in('student_id', student_ids)

    const portfolioIds      = (portfolioRows ?? []).map((r: any) => r.id as string)
    const portfolioToStudent = new Map<string, string>()
    for (const r of (portfolioRows ?? []) as { id: string; student_id: string }[]) {
      portfolioToStudent.set(r.id, r.student_id)
    }

    if (portfolioIds.length > 0) {
      const { data: projectRows } = await db
        .from('portfolio_projects')
        .select('portfolio_id, title, sort_order')
        .in('portfolio_id', portfolioIds)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })

      for (const p of (projectRows ?? []) as { portfolio_id: string; title: string; sort_order: number }[]) {
        const sid = portfolioToStudent.get(p.portfolio_id)
        if (!sid) continue
        const arr = portfolioMap.get(sid) ?? []
        arr.push({ title: p.title, sort_order: p.sort_order })
        portfolioMap.set(sid, arr)
      }
    }
  }

  // 3. Build preview rows
  const nameMap = new Map(students_meta.map(s => [s.student_id, s.student_name]))

  const preview: BulkPreviewStudent[] = student_ids.map(sid => {
    const student_name = nameMap.get(sid) ?? '—'

    if (issuedSet.has(sid)) {
      return { student_id: sid, student_name, status: 'already_issued', project_count: 0, has_portfolio: false, projects: [] }
    }

    if (project_mode === 'portfolio') {
      const projects    = portfolioMap.get(sid) ?? []
      return {
        student_id: sid,
        student_name,
        status:        'ready',
        project_count: projects.length,
        has_portfolio: projects.length > 0,
        projects,
      }
    }

    return {
      student_id:    sid,
      student_name,
      status:        'ready',
      project_count: shared_projects.length,
      has_portfolio: true,
      projects:      shared_projects,
    }
  })

  return { success: true, data: preview }
}

// ─── Issue bulk certificates ────────────────────────────────────────────────────
// Sequentially creates one certificate per student. Skips already-issued ones.
// XP awards are fire-and-forget per the single-issue pattern.

export async function issueBulkGroupCertificates(
  input: BulkIssueInput,
): Promise<ActionResult<BulkIssueResult>> {
  const user = await requirePermission('manage_certificates')

  const {
    group_id, branch_id, student_ids, course_id, semester_id,
    certificate_type, title, template_id, project_mode, shared_projects,
  } = input

  if (!student_ids.length) {
    return { success: false, error: { code: 'VALIDATION', message: 'No students provided.' } }
  }
  if (!title.trim()) {
    return { success: false, error: { code: 'VALIDATION', message: 'Certificate title (course name) is required.' } }
  }
  if (!isBranchAccessible(user, branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: "You do not have access to this group's branch." } }
  }

  const db = createServiceClient()

  // Batch-load student names and branches
  const { data: studentRows } = await db
    .from('students')
    .select('id, branch_id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
    .in('id', student_ids)

  const studentMap = new Map<string, { recipient_name: string; branch_id: string }>()
  for (const row of (studentRows ?? []) as any[]) {
    const profile = row.users?.profiles
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || row.users?.email || '—'
    studentMap.set(row.id as string, { recipient_name: name, branch_id: row.branch_id })
  }

  // Batch-load portfolio projects when using portfolio mode
  const portfolioMap = new Map<string, { title: string; sort_order: number }[]>()

  if (project_mode === 'portfolio') {
    const { data: portfolioRows } = await db
      .from('student_portfolios')
      .select('id, student_id')
      .in('student_id', student_ids)

    const portfolioIds      = (portfolioRows ?? []).map((r: any) => r.id as string)
    const portfolioToStudent = new Map<string, string>()
    for (const r of (portfolioRows ?? []) as { id: string; student_id: string }[]) {
      portfolioToStudent.set(r.id, r.student_id)
    }

    if (portfolioIds.length > 0) {
      const { data: projectRows } = await db
        .from('portfolio_projects')
        .select('portfolio_id, title, sort_order')
        .in('portfolio_id', portfolioIds)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })

      for (const p of (projectRows ?? []) as { portfolio_id: string; title: string; sort_order: number }[]) {
        const sid = portfolioToStudent.get(p.portfolio_id)
        if (!sid) continue
        const arr = portfolioMap.get(sid) ?? []
        arr.push({ title: p.title, sort_order: p.sort_order })
        portfolioMap.set(sid, arr)
      }
    }
  }

  // Final duplicate guard (protects against race conditions since preview was loaded earlier)
  let existingQuery = db
    .from('certificates')
    .select('student_id')
    .in('student_id', student_ids)
    .neq('status', 'revoked')

  if (course_id) existingQuery = existingQuery.eq('course_id', course_id)
  else           existingQuery = existingQuery.is('course_id', null)

  if (semester_id) existingQuery = existingQuery.eq('semester_id', semester_id)
  else             existingQuery = existingQuery.is('semester_id', null)

  const { data: existingRows } = await existingQuery
  const alreadyIssuedSet = new Set((existingRows ?? []).map((r: any) => r.student_id as string))

  // Generate batch identifier (display-only — not persisted as a column)
  const suffix  = Math.random().toString(36).substring(2, 10).toUpperCase()
  const batchId = `BULK-${new Date().getFullYear()}-${suffix}`

  let created = 0
  let skipped = 0
  let failed  = 0

  for (const student_id of student_ids) {
    if (alreadyIssuedSet.has(student_id)) { skipped++; continue }

    const studentInfo = studentMap.get(student_id)
    if (!studentInfo) { failed++; continue }

    // Per-student branch access guard
    if (!isBranchAccessible(user, studentInfo.branch_id)) { skipped++; continue }

    const projects = project_mode === 'portfolio'
      ? (portfolioMap.get(student_id) ?? [])
      : shared_projects

    // Generate unique certificate code (retry up to 5 times on collision)
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
    if (!code) { failed++; continue }

    const { data, error } = await db
      .from('certificates')
      .insert({
        certificate_code: code,
        template_id:      template_id ?? null,
        student_id,
        certificate_type,
        title:            title.trim(),
        description:      `Issued in bulk. Batch: ${batchId}`,
        recipient_name:   studentInfo.recipient_name,
        projects,
        semester_id:      semester_id ?? null,
        course_id:        course_id   ?? null,
        valid_until:      null,
        branch_id,
        issued_by:        user.id,
      })
      .select('id, certificate_code')
      .single()

    if (error || !data) { failed++; continue }

    const row = data as any

    // Audit log (non-blocking but awaited to keep sequential order)
    await db.rpc('write_audit_log', {
      p_performed_by: user.id,
      p_action:       'issue_certificate',
      p_entity_type:  'certificate',
      p_entity_id:    row.id,
      p_new_values:   {
        certificate_code: row.certificate_code,
        student_id,
        bulk_group_id:    group_id,
        batch_id:         batchId,
      },
    })

    // XP + achievements — fire-and-forget, same as single issuance
    void (async () => {
      try {
        await awardXP(student_id, XP_AWARDS.CERTIFICATE_EARNED, false)
        if (course_id) {
          const { data: courseRow } = await db.from('courses').select('title').eq('id', course_id).maybeSingle()
          await checkCourseAchievement(student_id, (courseRow as any)?.title ?? null)
        }
        await checkAndUnlockAchievements(student_id)
        await checkAndAwardBadges(student_id)
      } catch { /* XP is never critical */ }
    })()

    created++
  }

  revalidatePath('/admin/certificates')
  revalidatePath('/portal/team-leader/certificates')

  return {
    success: true,
    data: { created, skipped, failed, batch_id: batchId },
  }
}
