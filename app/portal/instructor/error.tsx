'use client'

import Link from 'next/link'
import WorkflowNotice from '@/components/portal/instructor/WorkflowNotice'

export default function InstructorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="mx-auto max-w-xl p-4 md:p-8">
    <h1 className="text-xl font-bold text-(--navy)">We could not load this page</h1>
    <WorkflowNotice tone="error">Try loading it again. If this keeps happening, contact your team leader with the group name and the action you were trying to complete.</WorkflowNotice>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={reset} className="ds-btn-orange min-h-11">Try again</button><Link href="/portal/instructor/groups" className="ds-btn-outline min-h-11">Back to my groups</Link></div>
  </section>
}
