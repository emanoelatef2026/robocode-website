import type { ReactNode } from 'react'
import SessionIcon from '@/app/portal/instructor/groups/[id]/sessions/[sid]/SessionIcon'

export default function WorkflowNotice({ tone = 'info', children, action }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode; action?: ReactNode }) {
  const colors = { info: 'border-(--border) bg-(--bg-muted) text-(--text-2)', error: 'border-(--red-dark)/25 bg-(--red-soft) text-(--red-dark)', success: 'border-(--green-dark)/25 bg-(--green-soft) text-(--green-dark)', warning: 'border-(--amber-dark)/25 bg-(--amber-soft) text-(--amber-dark)' }
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`my-2 flex items-start gap-2 rounded-xl border p-3 text-sm font-medium leading-relaxed ${colors[tone]}`}>
    <span className="mt-0.5 shrink-0"><SessionIcon name={tone === 'success' ? 'present' : tone === 'error' ? 'warning' : tone === 'warning' ? 'late' : 'info'} /></span>
    <div className="min-w-0 flex-1">{children}{action && <div className="mt-2">{action}</div>}</div>
  </div>
}
