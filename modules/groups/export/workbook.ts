import * as XLSX from 'xlsx'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import type { GroupPnL }            from '@/modules/finance/types'
import type { BatchStudentRow }     from './types'
import { buildWhatsAppUrl }         from '@/lib/contact-utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtEGP(n: number): string {
  return `EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)}`
}

function autoWidth(ws: XLSX.WorkSheet): void {
  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  const widths: number[] = Array.from({ length: range.e.c + 1 }, () => 10)
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell?.v != null) {
        const len = String(cell.v).length
        if (len > widths[C]) widths[C] = Math.min(len + 2, 55)
      }
    }
  }
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

function freezeHeader(ws: XLSX.WorkSheet): void {
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
}

export type ExportRole = 'super_admin' | 'team_leader'

// ── Workbook builder ───────────────────────────────────────────────────────────

export function buildGroupsWorkbook(
  groups:   GroupOperationalRow[],
  pnlRows:  GroupPnL[],
  students: BatchStudentRow[],
  role:     ExportRole = 'super_admin',
): XLSX.WorkBook {
  const wb  = XLSX.utils.book_new()
  const isTL = role === 'team_leader'

  const pnlMap = new Map<string, GroupPnL>()
  for (const p of pnlRows) pnlMap.set(p.group_id, p)

  const groupMap = new Map<string, GroupOperationalRow>()
  for (const g of groups) groupMap.set(g.group_id, g)

  // ── Sheet 1: Academy Dashboard — Super Admin only ─────────────────────────────
  if (!isTL) {
    const totalExpected       = pnlRows.reduce((s, r) => s + r.net_expected_revenue,  0)
    const totalCollected      = pnlRows.reduce((s, r) => s + r.net_collected_revenue, 0)
    const totalOutstanding    = pnlRows.reduce((s, r) => s + r.outstanding,           0)
    const totalInstructorCost = pnlRows.reduce((s, r) => s + r.final_instructor_cost, 0)
    const totalProfit         = pnlRows.reduce((s, r) => s + r.actual_profit,         0)
    const totalStudents       = groups.reduce((s, g) => s + g.student_count, 0)

    const dashboard = [
      { 'Metric': 'Exported At',             'Value': new Date().toLocaleString('en-EG') },
      { 'Metric': '',                         'Value': '' },
      { 'Metric': 'Total Groups',            'Value': groups.length },
      { 'Metric': 'Active Groups',           'Value': groups.filter(g => g.status === 'active').length },
      { 'Metric': 'Forming Groups',          'Value': groups.filter(g => g.status === 'forming').length },
      { 'Metric': 'Completed Groups',        'Value': groups.filter(g => g.status === 'completed').length },
      { 'Metric': 'Archived Groups',         'Value': groups.filter(g => g.status === 'archived' || g.status === 'cancelled').length },
      { 'Metric': 'Total Students',          'Value': totalStudents },
      { 'Metric': '',                         'Value': '' },
      { 'Metric': 'Total Expected Revenue',  'Value': fmtEGP(totalExpected) },
      { 'Metric': 'Total Collected',         'Value': fmtEGP(totalCollected) },
      { 'Metric': 'Total Outstanding',       'Value': fmtEGP(totalOutstanding) },
      { 'Metric': 'Total Instructor Cost',   'Value': fmtEGP(totalInstructorCost) },
      { 'Metric': 'Total Profit',            'Value': fmtEGP(totalProfit) },
    ]
    const ws1 = XLSX.utils.json_to_sheet(dashboard)
    autoWidth(ws1)
    XLSX.utils.book_append_sheet(wb, ws1, 'Academy Dashboard')
  }

  // ── Sheet 2: Groups Summary ───────────────────────────────────────────────────
  const groupsSummary = groups.map(g => {
    const pnl = pnlMap.get(g.group_id)
    const base = {
      'Group ID':       g.group_id,
      'Group Name':     g.name,
      'Branch':         g.branch_name,
      'Course':         g.course_name          ?? '—',
      'Instructor':     g.lead_instructor_name ?? '—',
      'Day':            g.day_of_week          ?? '—',
      'Time':           g.start_time           ?? '—',
      'Status':         g.status,
      'Capacity':       g.capacity             ?? '—',
      'Students Count': g.student_count,
      'Start Date':     g.start_date ?? '—',
      'End Date':       g.end_date   ?? '—',
      'Open Ended':     g.open_ended ? 'Yes' : 'No',
    }
    if (isTL) return base
    return {
      ...base,
      'Robocode Share %': g.robocode_share_percent,
      'Expected Revenue': pnl ? fmtEGP(pnl.net_expected_revenue)  : '—',
      'Collected':        pnl ? fmtEGP(pnl.net_collected_revenue)  : '—',
      'Outstanding':      pnl ? fmtEGP(pnl.outstanding)            : '—',
      'Instructor Cost':  pnl ? fmtEGP(pnl.final_instructor_cost)  : '—',
      'Profit':           pnl ? fmtEGP(pnl.actual_profit)          : '—',
    }
  })
  const ws2 = XLSX.utils.json_to_sheet(groupsSummary)
  autoWidth(ws2)
  freezeHeader(ws2)
  XLSX.utils.book_append_sheet(wb, ws2, 'Groups Summary')

  // ── Sheet 3: Students Details ─────────────────────────────────────────────────
  const studentsSheet = students.map(s => {
    const g = groupMap.get(s.group_id)
    return {
      'Group':           g?.name        ?? '—',
      'Branch':          g?.branch_name ?? '—',
      'Student Name':    s.student_name,
      'Student ID':      s.student_code ?? '—',
      'Age':             s.age          ?? '—',
      'Student Phone':   s.phone        ?? '—',
      'Parent Name':     s.parent_name  ?? '—',
      'Parent Phone':    s.parent_phone ?? '—',
      'Subscription':    fmtEGP(s.paid_amount + s.remaining_balance),
      'Paid':            fmtEGP(s.paid_amount),
      'Remaining':       fmtEGP(s.remaining_balance),
      'Sessions Left':   s.sessions_remaining ?? '—',
      'Attendance %':    `${s.attendance_pct}%`,
      'Risk':            s.risk_level,
      'Joined Date':     s.joined_at ? s.joined_at.slice(0, 10) : '—',
    }
  })
  const ws3 = XLSX.utils.json_to_sheet(studentsSheet)
  autoWidth(ws3)
  freezeHeader(ws3)
  XLSX.utils.book_append_sheet(wb, ws3, 'Students Details')

  // ── Sheet 4: Collections Follow-up ────────────────────────────────────────────
  const collections = students
    .filter(s => s.remaining_balance > 0)
    .map(s => {
      const g     = groupMap.get(s.group_id)
      const waUrl = buildWhatsAppUrl(s.parent_phone, s.phone) ?? '—'
      return {
        'Group':          g?.name        ?? '—',
        'Student':        s.student_name,
        'Parent':         s.parent_name  ?? '—',
        'Parent Phone':   s.parent_phone ?? '—',
        'Paid':           fmtEGP(s.paid_amount),
        'Remaining':      fmtEGP(s.remaining_balance),
        'Sessions Left':  s.sessions_remaining ?? '—',
        'Risk':           s.risk_level,
        'WhatsApp Link':  waUrl,
      }
    })
  const ws4 = XLSX.utils.json_to_sheet(collections)
  autoWidth(ws4)
  freezeHeader(ws4)
  XLSX.utils.book_append_sheet(wb, ws4, 'Collections Follow-up')

  // ── Sheet 5: Instructor Schedule ──────────────────────────────────────────────
  const instrRows = pnlRows
    .filter(p => !!p.instructor_name)
    .map(p => {
      const g       = groupMap.get(p.group_id)
      const sortKey = `${p.instructor_name ?? ''}|${g?.day_of_week ?? ''}|${g?.start_time ?? ''}`
      const base    = {
        'Instructor':         p.instructor_name ?? '—',
        'Branch':             p.branch_name,
        'Group':              p.group_name,
        'Course':             p.course_name  ?? '—',
        'Day':                g?.day_of_week ?? '—',
        'Time':               g?.start_time  ?? '—',
        'Students Count':     p.student_count,
        'Sessions Completed': p.completed_sessions,
        'Sessions Remaining': p.remaining_sessions,
      }
      const row = isTL ? base : {
        ...base,
        'Instructor Earned':    fmtEGP(p.instructor_earned),
        'Instructor Remaining': fmtEGP(p.instructor_remaining),
      }
      return { sortKey, row }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ row }) => row)

  const ws5 = XLSX.utils.json_to_sheet(instrRows)
  autoWidth(ws5)
  freezeHeader(ws5)
  XLSX.utils.book_append_sheet(wb, ws5, 'Instructor Schedule')

  // ── Sheet 6: WhatsApp Campaign ────────────────────────────────────────────────
  const campaign = students
    .filter(s => s.remaining_balance > 0)
    .map(s => {
      const g     = groupMap.get(s.group_id)
      const phone = s.parent_phone ?? s.phone ?? null
      const waUrl = buildWhatsAppUrl(s.parent_phone, s.phone) ?? '—'
      return {
        'Group':          g?.name ?? '—',
        'Student':        s.student_name,
        'Parent':         s.parent_name  ?? '—',
        'Phone':          phone          ?? '—',
        'Remaining':      fmtEGP(s.remaining_balance),
        'Risk':           s.risk_level,
        'WhatsApp Link':  waUrl,
      }
    })
  const ws6 = XLSX.utils.json_to_sheet(campaign)
  autoWidth(ws6)
  freezeHeader(ws6)
  XLSX.utils.book_append_sheet(wb, ws6, 'WhatsApp Campaign')

  return wb
}

export function downloadGroupsWorkbook(
  groups:   GroupOperationalRow[],
  pnlRows:  GroupPnL[],
  students: BatchStudentRow[],
  role:     ExportRole = 'super_admin',
): void {
  const wb       = buildGroupsWorkbook(groups, pnlRows, students, role)
  const filename = `groups-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
