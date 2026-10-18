'use client'

import Link from 'next/link'

export default function SessionError({ reset }: { reset: () => void }) {
  return <section role="alert" className="ds-card mx-auto max-w-xl space-y-4 p-6">
    <h1 className="text-xl font-bold text-(--navy)">Unable to load this session</h1>
    <p className="text-sm font-medium text-(--text-3)">We could not load the latest session data. Retry before making more changes.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-(--orange-strong) px-5 py-2 font-semibold text-white">Try again</button>
      <Link href="/portal/instructor/groups" className="min-h-11 rounded-xl border border-(--border) px-5 py-2 font-medium text-(--navy)">Back to groups</Link>
    </div>
  </section>
}
