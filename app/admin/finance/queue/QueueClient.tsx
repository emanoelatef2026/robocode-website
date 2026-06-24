'use client'
import { useTransition, useState } from 'react'
import { recordActivity, addPaymentPromise } from '@/modules/finance/actions'
import type { CollectionQueueItem } from '@/modules/finance/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function dateFmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface Props {
  item: CollectionQueueItem
  mode: 'desktop' | 'mobile'
}

export default function QueueClient({ item, mode }: Props) {
  const [pending, start] = useTransition()
  const [done, setDone]  = useState<string | null>(null)

  function buildWaLink() {
    const phone = item.parent_phone_1 ?? item.parent_phone_2
    if (!phone) return null
    const clean = phone.replace(/\D/g, '').replace(/^0/, '20')
    const msg = encodeURIComponent(
      `عزيزي ولي الأمر،\nنود تذكيركم بأن الدفعة المستحقة من ${item.student_name} بمبلغ EGP ${fmt(item.remaining_amount)} لم يتم سدادها.${item.next_due_date ? `\nتاريخ الاستحقاق: ${dateFmt(item.next_due_date)}` : item.days_overdue > 0 ? `\nمتأخرة منذ ${item.days_overdue} يوم.` : ''}\nيرجى التواصل معنا في أقرب وقت. شكراً 🙏 Robocode Academy`
    )
    return `https://wa.me/${clean}?text=${msg}`
  }

  async function logCall() {
    start(async () => {
      await recordActivity({ student_id: item.student_id, account_id: item.account_id, activity_type: 'CALL' })
      setDone('call')
    })
  }

  async function logReminder() {
    start(async () => {
      await recordActivity({ student_id: item.student_id, account_id: item.account_id, activity_type: 'PAYMENT_REMINDER' })
      setDone('reminder')
    })
  }

  const waLink = buildWaLink()

  if (mode === 'mobile') {
    return (
      <div className="px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[#0B1F3A]">{item.student_name}</p>
            {item.parent_phone_1 && <p className="text-[12px] text-[#64748B]">{item.parent_phone_1}</p>}
          </div>
          <span className="font-bold text-[#EF4444]">EGP {fmt(item.remaining_amount)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[#94A3B8]">
          <span>{item.branch_name}</span>
          {item.group_name && <><span>·</span><span>{item.group_name}</span></>}
          {item.days_overdue > 0 && (
            <span className="font-semibold text-[#EF4444]">{item.days_overdue}d late</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButtons item={item} waLink={waLink} logCall={logCall} logReminder={logReminder} pending={pending} done={done} />
        </div>
      </div>
    )
  }

  return (
    <tr className="ds-table-row">
      <td className="px-4 py-3">
        <p className="font-medium text-[#0B1F3A]">{item.student_name}</p>
        {item.student_code && <p className="font-mono text-[11px] text-[#94A3B8]">{item.student_code}</p>}
      </td>
      <td className="px-4 py-3">
        <p className="text-[#64748B]">{item.parent_name ?? '—'}</p>
        {item.parent_phone_1 && <p className="text-[12px] font-medium text-[#0B1F3A]">{item.parent_phone_1}</p>}
      </td>
      <td className="px-4 py-3">
        <p className="text-[#64748B]">{item.branch_name}</p>
        {item.group_name && <p className="text-[12px] text-[#94A3B8]">{item.group_name}</p>}
      </td>
      <td className="px-4 py-3 text-right font-bold text-[#EF4444]">
        EGP {fmt(item.remaining_amount)}
      </td>
      <td className="px-4 py-3 text-center">
        {item.days_overdue > 0 ? (
          <span className="inline-block rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-semibold text-[#EF4444]">
            {item.days_overdue}d
          </span>
        ) : (
          <span className="text-[#94A3B8] text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] text-[#64748B]">
        {item.last_activity_at ? (
          <div>
            <p className="text-[#0B1F3A]">{item.last_activity_type?.replace(/_/g, ' ')}</p>
            <p className="text-[#94A3B8]">{dateFmt(item.last_activity_at)}</p>
          </div>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-[12px]">
        {item.active_promise ? (
          <div>
            <p className="font-medium text-[#2563EB]">EGP {fmt(item.active_promise.amount)}</p>
            <p className="text-[#94A3B8]">{dateFmt(item.active_promise.date)}</p>
          </div>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <ActionButtons item={item} waLink={waLink} logCall={logCall} logReminder={logReminder} pending={pending} done={done} />
        </div>
      </td>
    </tr>
  )
}

function ActionButtons({
  item, waLink, logCall, logReminder, pending, done,
}: {
  item:        CollectionQueueItem
  waLink:      string | null
  logCall:     () => void
  logReminder: () => void
  pending:     boolean
  done:        string | null
}) {
  return (
    <>
      {item.parent_phone_1 && (
        <a
          href={`tel:${item.parent_phone_1}`}
          onClick={logCall}
          className="inline-flex items-center gap-1 rounded-lg bg-[#3B82F6] px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-600"
        >
          📞 Call
        </a>
      )}
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          onClick={async () => {
            const { recordActivity } = await import('@/modules/finance/actions')
            recordActivity({ student_id: item.student_id, account_id: item.account_id, activity_type: 'WHATSAPP' })
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#1eb955]"
        >
          💬 WA
        </a>
      )}
      <a
        href={`/admin/students/${item.student_id}?tab=finance`}
        className="inline-flex items-center ds-card px-2 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
      >
        View
      </a>
      <button
        onClick={logReminder}
        disabled={pending || done === 'reminder'}
        className="inline-flex items-center ds-card px-2 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50"
      >
        {done === 'reminder' ? '✓' : '🔔'}
      </button>
    </>
  )
}
