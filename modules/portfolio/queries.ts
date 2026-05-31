import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  StudentPortfolio,
  PortfolioProject,
  PortfolioProjectListItem,
  StudentAchievement,
  StudentBadge,
  StudentPortfolioDetail,
  PortfolioStudentSummary,
  PromotableSubmission,
} from './types'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

// ─── Portfolio CRUD ────────────────────────────────────────────────────────────

export async function getOrCreatePortfolio(studentId: string): Promise<StudentPortfolio> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('student_portfolios')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing) return existing as StudentPortfolio

  const { data, error } = await db
    .from('student_portfolios')
    .insert({ student_id: studentId })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create portfolio')
  return data as StudentPortfolio
}

export async function getPortfolioByStudentId(studentId: string): Promise<StudentPortfolio | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('student_portfolios')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()
  return (data as StudentPortfolio | null) ?? null
}

// ─── Student list with portfolio stats ────────────────────────────────────────

export async function listStudentPortfolioSummaries(
  search = '',
  branchIds?: string[]
): Promise<PortfolioStudentSummary[]> {
  const db = createServiceClient()

  let query = db
    .from('students')
    .select(
      `id, branch_id,
       users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!students_branch_id_fkey(name),
       student_portfolios(
         id,
         portfolio_projects(id, is_featured, is_archived),
         student_achievements(id),
         student_badges(id)
       )`
    )
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('id')

  if (branchIds && branchIds.length > 0) {
    query = query.in('branch_id', branchIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as any[]

  const summaries: PortfolioStudentSummary[] = rows.map((row) => {
    const profile   = row.users?.profiles
    const name      = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.users?.email || '—'
    const portfolio = Array.isArray(row.student_portfolios) ? row.student_portfolios[0] : row.student_portfolios

    const projects      = (portfolio?.portfolio_projects ?? []) as any[]
    const achievements  = (portfolio?.student_achievements ?? []) as any[]
    const badges        = (portfolio?.student_badges ?? []) as any[]

    return {
      student_id:        row.id,
      student_name:      name,
      student_email:     row.users?.email ?? '',
      branch_name:       row.branches?.name ?? '—',
      portfolio_id:      portfolio?.id ?? null,
      project_count:     projects.filter((p: any) => !p.is_archived).length,
      featured_count:    projects.filter((p: any) => p.is_featured && !p.is_archived).length,
      achievement_count: achievements.length,
      badge_count:       badges.length,
    }
  })

  if (search) {
    const q = search.toLowerCase()
    return summaries.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.student_email.toLowerCase().includes(q)
    )
  }

  return summaries
}

// ─── Full portfolio detail (admin / instructor view) ─────────────────────────

export async function getStudentPortfolioDetail(
  studentId: string
): Promise<StudentPortfolioDetail | null> {
  const db = createServiceClient()

  // Student info
  const { data: student, error: sErr } = await db
    .from('students')
    .select(
      `id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`
    )
    .eq('id', studentId)
    .is('deleted_at', null)
    .single()

  if (sErr || !student) return null
  const s = student as any
  const profile = s.users?.profiles
  const name    = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || s.users?.email || '—'

  // Portfolio (create if missing)
  const portfolio = await getOrCreatePortfolio(studentId)

  // Projects
  const { data: rawProjects } = await db
    .from('portfolio_projects')
    .select(
      `id, title, description, thumbnail_url, is_featured, is_public, is_archived,
       sort_order, final_score, created_at, student_id,
       category, status, project_url, video_url, instructor_feedback,
       courses!portfolio_projects_course_id_fkey(title),
       semesters!portfolio_projects_semester_id_fkey(name)`
    )
    .eq('portfolio_id', portfolio.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const projects: PortfolioProjectListItem[] = (rawProjects ?? []).map((p: any) => ({
    id:                  p.id,
    title:               p.title,
    description:         p.description       ?? null,
    thumbnail_url:       p.thumbnail_url      ?? null,
    is_featured:         p.is_featured,
    is_public:           p.is_public,
    is_archived:         p.is_archived,
    sort_order:          p.sort_order,
    course_title:        p.courses?.title     ?? null,
    semester_name:       p.semesters?.name    ?? null,
    final_score:         p.final_score        ?? null,
    created_at:          p.created_at,
    category:            p.category           ?? null,
    status:              p.status             ?? null,
    project_url:         p.project_url        ?? null,
    video_url:           p.video_url          ?? null,
    instructor_feedback: p.instructor_feedback ?? null,
    student_id:          p.student_id,
  }))

  // Achievements
  const { data: rawAchievements } = await db
    .from('student_achievements')
    .select('*')
    .eq('student_id', studentId)
    .order('date_awarded', { ascending: false })

  // Badges
  const { data: rawBadges } = await db
    .from('student_badges')
    .select('*')
    .eq('student_id', studentId)
    .order('awarded_at', { ascending: false })

  return {
    portfolio,
    projects,
    achievements: (rawAchievements ?? []) as StudentAchievement[],
    badges:       (rawBadges ?? []) as StudentBadge[],
    student_id:    studentId,
    student_name:  name,
    student_email: s.users?.email ?? '',
  }
}

// ─── Single project ────────────────────────────────────────────────────────────

export async function getPortfolioProject(id: string): Promise<PortfolioProject | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('portfolio_projects')
    .select(
      `*,
       courses!portfolio_projects_course_id_fkey(title),
       semesters!portfolio_projects_semester_id_fkey(name)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null
  const row = data as any
  return {
    ...row,
    course_title:  row.courses?.title ?? null,
    semester_name: row.semesters?.name ?? null,
  } as PortfolioProject
}

// ─── Promotable submissions ───────────────────────────────────────────────────

export async function listPromotableSubmissions(
  studentId: string
): Promise<PromotableSubmission[]> {
  const db = createServiceClient()

  const [{ data: subRows }, { data: alreadyPromoted }] = await Promise.all([
    db
      .from('submissions')
      .select(
        `id, submitted_at, score, public_feedback,
         drive_url, github_url, project_url, video_url,
         assignments!submissions_assignment_id_fkey(
           title, type,
           course_modules!assignments_module_id_fkey(
             courses!course_modules_course_id_fkey(title)
           )
         )`
      )
      .eq('student_id', studentId)
      .eq('portfolio_visible', true)
      .order('submitted_at', { ascending: false }),
    db
      .from('portfolio_projects')
      .select('submission_id')
      .eq('student_id', studentId)
      .not('submission_id', 'is', null),
  ])

  const promotedIds = new Set((alreadyPromoted ?? []).map((p: any) => p.submission_id))

  return (subRows ?? []).map((row: any) => {
    const a    = row.assignments
    const mod  = a?.course_modules
    const courseTitle = mod?.courses?.title ?? null

    return {
      id:               row.id,
      assignment_title: a?.title ?? '—',
      assignment_type:  a?.type ?? 'project',
      course_title:     courseTitle,
      submitted_at:     row.submitted_at,
      final_score:      row.score ?? null,
      public_feedback:  row.public_feedback ?? null,
      drive_url:        row.drive_url ?? null,
      github_url:       row.github_url ?? null,
      project_url:      row.project_url ?? null,
      video_url:        row.video_url ?? null,
      already_promoted: promotedIds.has(row.id),
    }
  })
}

// ─── Portfolio view for student (own) ────────────────────────────────────────

export async function getOwnPortfolioDetail(userId: string): Promise<StudentPortfolioDetail | null> {
  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student) return null
  return getStudentPortfolioDetail((student as any).id)
}

// ─── Parent: portfolio for a specific child ───────────────────────────────────

export async function getChildPortfolioDetail(
  parentUserId: string,
  studentId: string
): Promise<StudentPortfolioDetail | null> {
  const db = createServiceClient()

  // Verify parent is linked to this student
  const { data: link } = await db
    .from('parent_students')
    .select('student_id')
    .eq('student_id', studentId)
    .in(
      'parent_id',
      (
        await db
          .from('parents')
          .select('id')
          .eq('user_id', parentUserId)
      ).data?.map((p: any) => p.id) ?? []
    )
    .maybeSingle()

  if (!link) return null
  return getStudentPortfolioDetail(studentId)
}

// ─── Instructor portfolio review queue ────────────────────────────────────────

export async function listProjectsForInstructorReview(
  instructorId: string,
  status: 'pending_review' | 'approved' | 'featured' | 'needs_improvement' = 'pending_review'
): Promise<PortfolioProjectListItem[]> {
  const db = createServiceClient()

  // Get group ids from instructor's groups
  const [{ data: gcDirect }, { data: giRows }] = await Promise.all([
    db.from('group_courses').select('group_id').eq('instructor_id', instructorId).eq('status', 'active'),
    db.from('group_instructors').select('group_id').eq('instructor_id', instructorId),
  ])
  const groupIdSet = new Set<string>([
    ...(gcDirect ?? []).map((r: any) => r.group_id as string),
    ...(giRows ?? []).map((r: any) => r.group_id as string),
  ])
  if (groupIdSet.size === 0) return []

  // Get student ids from those groups
  const { data: gsRows } = await db
    .from('group_students')
    .select('student_id')
    .in('group_id', [...groupIdSet])
    .eq('status', 'active')
  const studentIds = [...new Set((gsRows ?? []).map((r: any) => r.student_id as string))]
  if (studentIds.length === 0) return []

  // Get portfolio ids
  const { data: portRows } = await db
    .from('student_portfolios')
    .select('id, student_id')
    .in('student_id', studentIds)
  const portStudentMap = new Map((portRows ?? []).map((p: any) => [p.id as string, p.student_id as string]))
  const portIds = [...portStudentMap.keys()]
  if (portIds.length === 0) return []

  // Get student names
  const { data: studRows } = await db
    .from('students')
    .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .in('id', studentIds)
  const nameMap = new Map((studRows ?? []).map((s: any) => {
    const p = s.users?.profiles
    return [s.id as string, [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown']
  }))

  const { data: projRows } = await db
    .from('portfolio_projects')
    .select(
      `id, title, description, thumbnail_url, is_featured, is_public, is_archived,
       sort_order, final_score, created_at, student_id, portfolio_id,
       category, status, project_url, video_url, instructor_feedback,
       courses!portfolio_projects_course_id_fkey(title)`
    )
    .in('portfolio_id', portIds)
    .eq('status', status)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  return (projRows ?? []).map((p: any) => ({
    id:                  p.id,
    title:               p.title,
    description:         p.description       ?? null,
    thumbnail_url:       p.thumbnail_url      ?? null,
    is_featured:         p.is_featured,
    is_public:           p.is_public,
    is_archived:         p.is_archived,
    sort_order:          p.sort_order,
    course_title:        p.courses?.title     ?? null,
    semester_name:       null,
    final_score:         p.final_score        ?? null,
    created_at:          p.created_at,
    category:            p.category           ?? null,
    status:              p.status             ?? null,
    project_url:         p.project_url        ?? null,
    video_url:           p.video_url          ?? null,
    instructor_feedback: p.instructor_feedback ?? null,
    student_id:          p.student_id,
    student_name:        nameMap.get(p.student_id) ?? 'Unknown',
  }))
}

// ─── Team Leader: all projects in branch, by status ──────────────────────────

export async function listAllProjectsForTL(
  branchIds: string[],
  status: 'pending_review' | 'approved' | 'needs_improvement' | 'featured' = 'pending_review'
): Promise<PortfolioProjectListItem[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // Get students in the TL's branches
  const { data: studentRows } = await db
    .from('students')
    .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .in('branch_id', branchIds)
    .is('deleted_at', null)
    .eq('status', 'active')

  if (!studentRows || studentRows.length === 0) return []

  const studentIds = studentRows.map((s: any) => s.id as string)
  const nameMap    = new Map(studentRows.map((s: any) => {
    const p = s.users?.profiles
    return [s.id as string, [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown']
  }))

  // Get portfolio ids for these students
  const { data: portRows } = await db
    .from('student_portfolios')
    .select('id, student_id')
    .in('student_id', studentIds)
  if (!portRows || portRows.length === 0) return []

  const portIds = portRows.map((p: any) => p.id as string)

  const { data: projRows } = await db
    .from('portfolio_projects')
    .select(
      `id, title, description, thumbnail_url, is_featured, is_public, is_archived,
       sort_order, final_score, created_at, student_id,
       category, status, project_url, video_url, instructor_feedback,
       courses!portfolio_projects_course_id_fkey(title)`
    )
    .in('portfolio_id', portIds)
    .eq('status', status)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  return (projRows ?? []).map((p: any) => ({
    id:                  p.id,
    title:               p.title,
    description:         p.description        ?? null,
    thumbnail_url:       p.thumbnail_url       ?? null,
    is_featured:         p.is_featured,
    is_public:           p.is_public,
    is_archived:         p.is_archived,
    sort_order:          p.sort_order,
    course_title:        p.courses?.title      ?? null,
    semester_name:       null,
    final_score:         p.final_score         ?? null,
    created_at:          p.created_at,
    category:            p.category            ?? null,
    status:              p.status              ?? null,
    project_url:         p.project_url         ?? null,
    video_url:           p.video_url           ?? null,
    instructor_feedback: p.instructor_feedback  ?? null,
    student_id:          p.student_id,
    student_name:        nameMap.get(p.student_id) ?? 'Unknown',
  }))
}

// ─── Search ────────────────────────────────────────────────────────────────────

export async function searchPortfolioProjects(query: string): Promise<
  { id: string; student_id: string; student_name: string; title: string; course_title: string | null }[]
> {
  const db  = createServiceClient()
  const { data } = await db
    .from('portfolio_projects')
    .select(
      `id, student_id, title,
       courses!portfolio_projects_course_id_fkey(title),
       student_portfolios!portfolio_projects_portfolio_id_fkey(
         students!student_portfolios_student_id_fkey(
           users!students_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )
       )`
    )
    .ilike('title', `%${query}%`)
    .eq('is_archived', false)
    .limit(10)

  return (data ?? []).map((row: any) => {
    const profile = row.student_portfolios?.students?.users?.profiles
    const name    = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—'
    return {
      id:           row.id,
      student_id:   row.student_id,
      student_name: name,
      title:        row.title,
      course_title: row.courses?.title ?? null,
    }
  })
}
