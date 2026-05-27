import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  Certificate,
  CertificateDetail,
  CertificateListItem,
  CertificateSnapshot,
  CertificateTemplate,
  CertificateTemplateListItem,
  CertificateVerification,
} from './types'
import type { PaginatedResult } from '@/types/app'

// ─── Certificate code generation ──────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCertificateCode(): string {
  const year = new Date().getFullYear()
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return `RBC-${year}-${suffix}`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listCertificateTemplates({
  page = 1,
  perPage = 20,
  search = '',
  type,
  branchId,
}: {
  page?: number
  perPage?: number
  search?: string
  type?: string
  branchId?: string
} = {}): Promise<PaginatedResult<CertificateTemplateListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('certificate_templates')
    .select(
      `id, name, certificate_type, description, is_active, branch_id, created_at,
       branches!certificate_templates_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search)   query = query.ilike('name', `%${search}%`)
  if (type)     query = query.eq('certificate_type', type)
  if (branchId) query = query.eq('branch_id', branchId)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: CertificateTemplateListItem[] = (data ?? []).map((row: any) => ({
    id:               row.id,
    name:             row.name,
    certificate_type: row.certificate_type,
    description:      row.description ?? null,
    is_active:        row.is_active,
    branch_id:        row.branch_id ?? null,
    branch_name:      row.branches?.name ?? null,
    created_at:       row.created_at,
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getCertificateTemplate(id: string): Promise<CertificateTemplate | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('certificate_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as CertificateTemplate
}

export async function listActiveTemplates(type?: string): Promise<CertificateTemplate[]> {
  const db = createServiceClient()
  let query = db
    .from('certificate_templates')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (type) query = query.eq('certificate_type', type)

  const { data } = await query
  return (data ?? []) as CertificateTemplate[]
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export async function listCertificates({
  page = 1,
  perPage = 20,
  search = '',
  studentId,
  type,
  status,
}: {
  page?: number
  perPage?: number
  search?: string
  studentId?: string
  type?: string
  status?: string
} = {}): Promise<PaginatedResult<CertificateListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('certificates')
    .select(
      `id, certificate_code, certificate_type, title, recipient_name, student_id,
       issued_at, status, branch_id,
       students!certificates_student_id_fkey(
         users!students_user_id_fkey(email)
       ),
       certificate_templates!certificates_template_id_fkey(name),
       semesters!certificates_semester_id_fkey(name),
       courses!certificates_course_id_fkey(title),
       branches!certificates_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .order('issued_at', { ascending: false })
    .range(from, to)

  if (studentId) query = query.eq('student_id', studentId)
  if (type)      query = query.eq('certificate_type', type)
  if (status)    query = query.eq('status', status)
  if (search)    query = query.or(`title.ilike.%${search}%,recipient_name.ilike.%${search}%,certificate_code.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: CertificateListItem[] = (data ?? []).map((row: any) => ({
    id:               row.id,
    certificate_code: row.certificate_code,
    certificate_type: row.certificate_type,
    title:            row.title,
    recipient_name:   row.recipient_name,
    student_id:       row.student_id,
    student_email:    row.students?.users?.email ?? '',
    issued_at:        row.issued_at,
    status:           row.status,
    semester_name:    row.semesters?.name ?? null,
    course_title:     row.courses?.title ?? null,
    template_name:    row.certificate_templates?.name ?? null,
    branch_name:      row.branches?.name ?? null,
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getCertificateDetail(id: string): Promise<CertificateDetail | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('certificates')
    .select(
      `*,
       certificate_templates!certificates_template_id_fkey(*),
       students!certificates_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       semesters!certificates_semester_id_fkey(name),
       courses!certificates_course_id_fkey(title),
       student_achievements!certificates_achievement_id_fkey(title)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null
  const row     = data as any
  const profile = row.students?.users?.profiles

  return {
    ...row,
    template:          row.certificate_templates as CertificateTemplate | null,
    student_name:      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.students?.users?.email || '—',
    student_email:     row.students?.users?.email ?? '',
    semester_name:     row.semesters?.name ?? null,
    course_title:      row.courses?.title ?? null,
    achievement_title: row.student_achievements?.title ?? null,
  } as CertificateDetail
}

export async function getCertificateByCode(code: string): Promise<Certificate | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('certificates')
    .select('*')
    .eq('certificate_code', code)
    .single()

  if (error || !data) return null
  return data as Certificate
}

// ─── Public verification ──────────────────────────────────────────────────────

export async function verifyCertificate(code: string): Promise<CertificateVerification | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('certificates')
    .select(
      `certificate_code, title, recipient_name, certificate_type, issued_at, valid_until, status,
       certificate_templates!certificates_template_id_fkey(signatory_name),
       semesters!certificates_semester_id_fkey(name),
       courses!certificates_course_id_fkey(title),
       certificate_snapshots!certificate_snapshots_certificate_id_fkey(
         attendance_score, assignment_score, portfolio_score, overall_score,
         courses_evaluated, threshold_attendance, threshold_assignment, threshold_overall,
         is_eligible
       )`
    )
    .eq('certificate_code', code)
    .single()

  if (error || !data) return null
  const row = data as any

  return {
    certificate_code: row.certificate_code,
    title:            row.title,
    recipient_name:   row.recipient_name,
    certificate_type: row.certificate_type,
    issued_at:        row.issued_at,
    valid_until:      row.valid_until ?? null,
    status:           row.status,
    semester_name:    row.semesters?.name ?? null,
    course_title:     row.courses?.title ?? null,
    issuer_name:      row.certificate_templates?.signatory_name ?? null,
    snapshot:         row.certificate_snapshots ?? null,
  }
}

export async function getCertificateSnapshot(certificateId: string): Promise<CertificateSnapshot | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('certificate_snapshots')
    .select('*')
    .eq('certificate_id', certificateId)
    .maybeSingle()

  if (error || !data) return null
  return data as CertificateSnapshot
}

// ─── Student own certificates ─────────────────────────────────────────────────

export async function getOwnCertificates(userId: string): Promise<CertificateListItem[]> {
  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student) return []

  const result = await listCertificates({ studentId: (student as any).id, perPage: 200 })
  return result.data
}

// ─── Parent: child certificates ───────────────────────────────────────────────

export async function getChildCertificates(
  parentUserId: string,
  studentId: string
): Promise<CertificateListItem[]> {
  const db = createServiceClient()

  const { data: link } = await db
    .from('parent_students')
    .select('student_id')
    .eq('student_id', studentId)
    .in(
      'parent_id',
      (await db.from('parents').select('id').eq('user_id', parentUserId)).data?.map((p: any) => p.id) ?? []
    )
    .maybeSingle()

  if (!link) return []

  const result = await listCertificates({ studentId, perPage: 200 })
  return result.data
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchCertificates(query: string): Promise<
  { id: string; certificate_code: string; title: string; recipient_name: string; student_id: string }[]
> {
  const db = createServiceClient()
  const { data } = await db
    .from('certificates')
    .select('id, certificate_code, title, recipient_name, student_id')
    .or(`title.ilike.%${query}%,recipient_name.ilike.%${query}%,certificate_code.ilike.%${query}%`)
    .eq('status', 'active')
    .limit(10)

  return data ?? []
}
