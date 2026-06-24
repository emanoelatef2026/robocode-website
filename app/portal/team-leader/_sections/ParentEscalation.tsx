import Link from 'next/link'
import { getParentEscalationData, type ParentEscalationItem } from '@/modules/tl-dashboard/dashboard-v2-queries'
import DashCard, { DashCardEmpty, DashRow } from '../_components/DashCard'
import WaCallButtons from '../_components/WaCallButtons'

function fmtAge(hours: number): string {
  if (hours < 1)   return 'Just now'
  if (hours < 24)  return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const PRIORITY_CLS: Record<string, string> = {
  high:   'bg-[#FEE2E2] text-[#DC2626]',
  medium: 'bg-[#FFFBEB] text-[#B45309]',
  low:    'bg-[#EFF6FF] text-[#1D4ED8]',
}

function EscalationRow({ item }: { item: ParentEscalationItem }) {
  return (
    <DashRow
      left={
        <>
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${PRIORITY_CLS[item.priority]}`}>
              {item.priority}
            </span>
            <p className="truncate text-[13px] font-medium text-[#0B1F3A] leading-snug">
              {item.student_name ?? 'Unknown student'}
            </p>
          </div>
          {item.subject && (
            <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{item.subject}</p>
          )}
          <p className="mt-0.5 text-[10px] text-[#94A3B8]">{fmtAge(item.age_hours)} · {item.status.replace('_', ' ')}</p>
        </>
      }
      actions={
        <div className="flex flex-col gap-1">
          <Link
            href={`/portal/team-leader/parent-feedback?tab=messages&id=${item.id}`}
            className="rounded-lg bg-[#0B1F3A] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#1a3352]"
          >
            Reply
          </Link>
          <WaCallButtons
            parentPhone={item.parent_phone}
            studentPhone={null}
            studentName={item.student_name ?? undefined}
            context={item.subject ?? 'Regarding your message to Robocode.'}
          />
        </div>
      }
    />
  )
}

export default async function ParentEscalation({ branchIds }: { branchIds: string[] }) {
  const escalations = await getParentEscalationData(branchIds)

  const highCount = escalations.filter(e => e.priority === 'high').length

  return (
    <section id="parent-escalation">
      <DashCard
        title="💬 Parent Escalations"
        count={escalations.length}
        badge={
          highCount > 0
            ? <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">{highCount} high</span>
            : undefined
        }
        accent={highCount > 0 ? 'border-[#FECACA]' : escalations.length > 0 ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'}
        action={
          <Link href="/portal/team-leader/parent-feedback?tab=messages&status=submitted" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
            View all →
          </Link>
        }
      >
        {escalations.length === 0
          ? <DashCardEmpty text="No open parent messages 🎉" />
          : escalations.map(e => <EscalationRow key={e.id} item={e} />)
        }
      </DashCard>
    </section>
  )
}
