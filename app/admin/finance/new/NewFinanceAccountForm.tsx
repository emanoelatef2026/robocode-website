'use client'
import { useTransition, useState } from 'react'
import { useRouter }                from 'next/navigation'
import { createOrUpdateFinancialAccount } from '@/modules/finance/actions'

interface Props {
  branches:        { id: string; name: string }[]
  groups:          { id: string; name: string; branch_id?: string }[]
  students:        { id: string; name: string; code: string | null; branch_id?: string }[]
  successRedirect?: string
}

export default function NewFinanceAccountForm({ branches, groups, students, successRedirect }: Props) {
  const router = useRouter()
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')
  const [search, setSearch]     = useState('')
  const [selectedBranch, setSelectedBranch] = useState(branches.length === 1 ? branches[0].id : '')

  // When multiple branches, filter groups and students to the selected branch
  const visibleGroups = selectedBranch
    ? groups.filter(g => !g.branch_id || g.branch_id === selectedBranch)
    : groups

  const filteredStudents = (selectedBranch
    ? students.filter(s => !s.branch_id || s.branch_id === selectedBranch)
    : students
  ).filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')

    const totalAmt = Number(fd.get('total_amount'))
    const discountAmt = Number(fd.get('discount_amount') ?? 0)

    if (discountAmt > totalAmt) {
      setErr('Discount cannot exceed total amount.')
      return
    }

    startPending(async () => {
      const r = await createOrUpdateFinancialAccount({
        student_id:      fd.get('student_id') as string,
        branch_id:       fd.get('branch_id') as string,
        group_id:        (fd.get('group_id') as string) || undefined,
        total_amount:    totalAmt,
        discount_amount: discountAmt,
        next_due_date:   (fd.get('next_due_date') as string) || undefined,
        notes:           (fd.get('notes') as string) || undefined,
      })
      if (r.error) { setErr(r.error); return }
      router.push(successRedirect ?? '/admin/finance')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="ds-card p-6 space-y-5">

      {/* Student */}
      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-2">Student *</label>
        <input
          placeholder="Search student…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20"
        />
        <select name="student_id" required
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
          <option value="">— Select student —</option>
          {filteredStudents.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.code ? ` (${s.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Branch */}
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">Branch *</label>
          <select
            name="branch_id"
            required
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20"
          >
            <option value="">— Select branch —</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* Group */}
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">Group</label>
          <select name="group_id"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
            <option value="">— No group —</option>
            {visibleGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Total */}
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">Total Amount (EGP) *</label>
          <input name="total_amount" type="number" min="0" step="0.01" required placeholder="e.g. 5000"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>

        {/* Discount */}
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">Discount Amount (EGP)</label>
          <input name="discount_amount" type="number" min="0" step="0.01" placeholder="0"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
      </div>

      {/* Next due date */}
      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">First Due Date</label>
        <input name="next_due_date" type="date"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">Notes (optional)</label>
        <textarea name="notes" rows={2}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none" />
      </div>

      {err && <p className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#EF4444]">{err}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="flex-1 rounded-xl bg-[#FF8A1F] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#e87c18] disabled:opacity-50 transition-colors">
          {pending ? 'Creating…' : 'Create Financial Account'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="rounded-xl border border-[#E2E8F0] px-6 py-3 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]">
          Cancel
        </button>
      </div>
    </form>
  )
}
