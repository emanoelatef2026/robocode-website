/**
 * Super Admin: Parent Communications Center
 *
 * Aggregates all parent messages across branches.
 * Hardened against missing FK names and empty states.
 */

import { createServiceClient }              from '@/lib/supabase/service'
import { requireAuth }                      from '@/modules/rbac/guards'
import { CATEGORY_LABELS, STATUS_CONFIG }   from '@/modules/parent-messages/constants'
import AdminFilterSelect                    from '@/components/admin/AdminFilterSelect'
import Pagination                           from '@/components/admin/Pagination'
import type { MessageStatus, MessageCategory } from '@/modules/parent-messages/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MessageRow {
  id:            string
  parent_name:   string | null
  student_name:  string | null
  branch_name:   string
  category:      string
  message:       string
  status:        string
  internal_note: string | null
  created_at:    string
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function listMessages({
  page = 1, perPage = 25, branchIds, status, category,
}: {
  page?: number; perPage?: number; branchIds?: string[]; status?: string; category?: string
}): Promise<{ data: MessageRow[]; total: number; page: number; perPage: number; totalPages: number }> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  try {
    // Minimal select first — avoids FK join failures on schema mismatches
    let q = db
      .from('parent_messages')
      .select('id, parent_user_id, student_id, branch_id, category, message, status, internal_note, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (branchIds?.length) q = q.in('branch_id', branchIds)
    if (status)            q = q.eq('status', status)
    if (category)          q = q.eq('category', category)

    const { data, count, error } = await q
    if (error) throw error

    const rows = (data ?? []) as any[]

    // Batch-resolve parent names
    const parentIds = [...new Set(rows.map(r => r.parent_user_id as string).filter(Boolean))]
    const parentMap = new Map<string, string | null>()
    if (parentIds.length > 0) {
      const { data: profs } = await db.from('profiles').select('user_id, first_name, last_name').in('user_id', parentIds)
      for (const p of profs ?? []) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || null
        parentMap.set((p as any).user_id, name)
      }
    }

    // Batch-resolve student names
    const studentIds = [...new Set(rows.map(r => r.student_id as string | null).filter(Boolean))] as string[]
    const studentMap = new Map<string, string | null>()
    if (studentIds.length > 0) {
      const { data: studs } = await db
        .from('students')
        .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
        .in('id', studentIds)
      for (const s of studs ?? []) {
        const prof = (s as any).users?.profiles
        studentMap.set((s as any).id, prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null)
      }
    }

    // Batch-resolve branch names
    const branchIdSet = [...new Set(rows.map(r => r.branch_id as string).filter(Boolean))]
    const branchMap   = new Map<string, string>()
    if (branchIdSet.length > 0) {
      const { data: brs } = await db.from('branches').select('id, name').in('id', branchIdSet)
      for (const b of brs ?? []) branchMap.set((b as any).id, (b as any).name ?? '—')
    }

    const items: MessageRow[] = rows.map(r => ({
      id:            r.id,
      parent_name:   parentMap.get(r.parent_user_id) ?? null,
      student_name:  r.student_id ? studentMap.get(r.student_id) ?? null : null,
      branch_name:   branchMap.get(r.branch_id) ?? '—',
      category:      r.category,
      message:       r.message,
      status:        r.status,
      internal_note: r.internal_note ?? null,
      created_at:    r.created_at,
    }))

    return { data: items, total: count ?? 0, page, perPage, totalPages: Math.ceil((count ?? 0) / perPage) }
  } catch (err: any) {
    // Graceful fallback — table may not exist in older installs
    console.error('[communications] listMessages error:', err?.message ?? err)
    return { data: [], total: 0, page, perPage, totalPages: 0 }
  }
}

async function getKPIs(branchIds?: string[]): Promise<{ open: number; under_review: number; resolved: number }> {
  const db = createServiceClient()
  try {
    const q = (s: string) => {
      const base = db.from('parent_messages').select('id', { count: 'exact', head: true }).eq('status', s)
      return branchIds?.length ? base.in('branch_id', branchIds) : base
    }
    const [open, review, resolved] = await Promise.all([q('submitted'), q('under_review'), q('resolved')])
    return {
      open:         (open as any).count     ?? 0,
      under_review: (review as any).count   ?? 0,
      resolved:     (resolved as any).count ?? 0,
    }
  } catch {
    return { open: 0, under_review: 0, resolved: 0 }
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ page?: string; branch?: string; status?: string; category?: string }>
}

const STATUSES: MessageStatus[]    = ['submitted', 'under_review', 'resolved']
const CATEGORIES: MessageCategory[] = Object.keys(CATEGORY_LABELS) as MessageCategory[]

export default async function CommunicationsPage({ searchParams }: Props) {
  const user   = await requireAuth()
  const params = await searchParams

  const isSuperAdmin  = user.globalRole === 'super_admin'
  const branchScope   = isSuperAdmin ? undefined : (user.branchIds.length > 0 ? user.branchIds : undefined)
  const branchFilter  = params.branch ? [params.branch] : branchScope

  const page     = Number(params.page ?? 1)
  const status   = params.status as MessageStatus | undefined
  const category = params.category as MessageCategory | undefined

  const [result, kpis] = await Promise.all([
    listMessages({ page, perPage: 25, branchIds: branchFilter, status, category }),
    getKPIs(branchFilter),
  ])

  const totalOpen = kpis.open + kpis.under_review

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Parent Communications</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Messages, feedback, and concerns submitted by parents</p>
        </div>
        {totalOpen > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {totalOpen} open
          </span>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Submitted (Open)',  count: kpis.open,         cls: kpis.open > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[#E2E8F0] bg-white text-[#0B1F3A]' },
          { label: 'Under Review',      count: kpis.under_review, cls: kpis.under_review > 0 ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-[#E2E8F0] bg-white text-[#0B1F3A]' },
          { label: 'Resolved',          count: kpis.resolved,     cls: 'border-[#E2E8F0] bg-white text-emerald-600' },
        ].map(({ label, count, cls }) => (
          <div key={label} className={`rounded-xl border p-4 ${cls}`}>
            <p className="text-2xl font-bold">{count}</p>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <AdminFilterSelect param="status" placeholder="All statuses"
            options={STATUSES.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))} />
          <AdminFilterSelect param="category" placeholder="All categories"
            options={CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))} />
        </div>

        {result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No messages found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {status || category
                ? 'Try removing filters.'
                : 'Parent messages appear here as parents submit feedback through their portal.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(msg => {
                    const sc  = STATUS_CONFIG[msg.status as MessageStatus] ?? { label: msg.status, cls: 'bg-slate-100 text-slate-600' }
                    const cat = CATEGORY_LABELS[msg.category as MessageCategory] ?? msg.category
                    return (
                      <tr key={msg.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-medium text-[#0B1F3A]">{msg.parent_name ?? <span className="text-[#94A3B8]">—</span>}</td>
                        <td className="px-4 py-3 text-[#64748B]">{msg.student_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">{msg.branch_name}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{cat}</td>
                        <td className="px-4 py-3 max-w-48">
                          <p className="truncate text-xs text-[#0B1F3A]" title={msg.message}>{msg.message}</p>
                          {msg.internal_note && (
                            <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">Note: {msg.internal_note}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${sc.cls}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">
                          {new Date(msg.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
