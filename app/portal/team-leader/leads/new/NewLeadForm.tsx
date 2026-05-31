'use client'

import { useActionState } from 'react'
import { useRouter }      from 'next/navigation'
import { useEffect }      from 'react'
import { createLead }     from '@/modules/leads/actions'
import { LEAD_SOURCES }   from '@/modules/leads/schemas'
import SubmitButton       from '@/components/admin/SubmitButton'
import type { ActionResult } from '@/types/app'

interface Branch { id: string; name: string }

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website', facebook_ad: 'Facebook Ad', instagram_ad: 'Instagram Ad',
  whatsapp: 'WhatsApp', referral: 'Referral', walk_in: 'Walk-In', other: 'Other',
}

const input = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'
const label = 'mb-1 block text-sm font-medium text-[#0B1F3A]'

export default function NewLeadForm({ branches }: { branches: Branch[] }) {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(createLead, null)

  useEffect(() => {
    if (state?.success) {
      router.push(`/portal/team-leader/leads/${state.data.id}`)
    }
  }, [state, router])

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={label}>Child Name <span className="text-red-500">*</span></label>
            <input name="child_name" required className={input} placeholder="e.g. Ahmed Mohamed" />
          </div>
          <div>
            <label className={label}>Parent Name</label>
            <input name="parent_name" className={input} placeholder="e.g. Mohamed Ali" />
          </div>
          <div>
            <label className={label}>Age</label>
            <input name="age" type="number" min={1} max={25} className={input} placeholder="e.g. 10" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Phone</label>
            <input name="phone" type="tel" className={input} placeholder="01012345678" />
          </div>
          <div>
            <label className={label}>WhatsApp</label>
            <input name="whatsapp" type="tel" className={input} placeholder="01012345678" />
          </div>
        </div>

        <div>
          <label className={label}>Email</label>
          <input name="email" type="email" className={input} placeholder="parent@email.com" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Branch</label>
            <select name="branch_id" className={input}>
              <option value="">Select branch…</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Source <span className="text-red-500">*</span></label>
            <select name="source" defaultValue="website" className={input}>
              {LEAD_SOURCES.map(s => (
                <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Interested Course</label>
          <input name="interested_course" className={input} placeholder="e.g. Scratch, Python, Robotics" />
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea
            name="notes"
            rows={3}
            className={`${input} resize-none`}
            placeholder="Any additional info…"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton label="Add Lead" pendingLabel="Adding…" />
        </div>
      </form>
    </div>
  )
}
