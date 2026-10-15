'use client'

import { useActionState, useState } from 'react'
import { createStudent } from '@/modules/students/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { BranchListItem } from '@/modules/branches/types'
import type { GroupListItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'
import { ExistingGuardianPicker } from '@/components/portal/shared/ExistingGuardianPicker'

interface Props {
  branches: BranchListItem[]
  groups:   GroupListItem[]
}

export default function NewStudentForm({ branches, groups }: Props) {
  const [guardian, setGuardian] = useState({
    name: '', phone1: '', phone2: '', source_contact_id: '', force_new_parent: false,
    relation: 'guardian', whatsapp_preferred: false, is_primary: true, is_emergency: true,
  })
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createStudent,
    null
  )

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/15'

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              First name <span className="text-[#EF4444]">*</span>
            </label>
            <input name="first_name" required className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Last name <span className="text-[#EF4444]">*</span>
            </label>
            <input name="last_name" required className={cls} />
          </div>
        </div>

        <p className="rounded-lg bg-[#EFF6FB] p-3 text-sm font-medium text-[#0B1F3A]">
          No passwords needed here. Generate student and parent login credentials from the group when ready.
        </p>

        {/* Branch + date_of_birth */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Branch <span className="text-[#EF4444]">*</span>
            </label>
            <select name="branch_id" required className={cls}>
              <option value="">Select branch…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Date of birth</label>
            <input name="date_of_birth" type="date" className={cls} />
          </div>
        </div>

        {/* School grade + address */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">School grade</label>
            <input name="school_grade" className={cls} placeholder="e.g. Grade 5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input name="phone" type="tel" className={cls} placeholder="+20 …" />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Address <span className="text-xs text-[#94A3B8]">(optional)</span></label>
          <input name="address" className={cls} />
        </div>

        <ExistingGuardianPicker onSelect={parent => setGuardian(current => ({
          ...current, name: parent.name, phone1: parent.phone1, phone2: parent.phone2,
          relation: parent.relation, whatsapp_preferred: parent.whatsappPreferred,
          source_contact_id: parent.contactId, force_new_parent: false,
        }))} />
        {guardian.source_contact_id && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#E7F8EE] p-3 text-sm font-semibold text-[#15803D]">
          Existing guardian selected.
          <button type="button" onClick={() => setGuardian(current => ({ ...current, name: '', phone1: '', phone2: '', source_contact_id: '' }))}>Clear selection</button>
        </div>}
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-[#0B1F3A]">Guardian name
            <input required value={guardian.name} readOnly={!!guardian.source_contact_id} onChange={e => setGuardian(current => ({ ...current, name: e.target.value }))} className={cls} />
          </label>
          <label className="block text-sm font-medium text-[#0B1F3A]">Relationship
            <select value={guardian.relation} onChange={e => setGuardian(current => ({ ...current, relation: e.target.value }))} className={cls}>
              {['father', 'mother', 'guardian', 'other'].map(relation => <option key={relation} value={relation}>{relation}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 1</label>
            <input name="parent_phone_1" type="tel" required value={guardian.phone1} readOnly={!!guardian.source_contact_id} onChange={e => setGuardian(current => ({ ...current, phone1: e.target.value }))} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 2</label>
            <input name="parent_phone_2" type="tel" value={guardian.phone2} readOnly={!!guardian.source_contact_id} onChange={e => setGuardian(current => ({ ...current, phone2: e.target.value }))} className={cls} />
          </div>
        </div>
        {!guardian.source_contact_id && <label className="flex items-start gap-2 text-xs font-medium text-[#526985]">
          <input type="checkbox" checked={guardian.force_new_parent} onChange={e => setGuardian(current => ({ ...current, force_new_parent: e.target.checked }))} />
          This is a different guardian sharing an existing phone number (do not link to the existing family).
        </label>}
        <input type="hidden" name="parent_contacts_json" value={JSON.stringify([guardian])} />

        {/* Enrollment date + group */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Enrollment date</label>
            <input
              name="enrollment_date"
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className={cls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Assign to group</label>
            <select name="group_id" className={cls}>
              <option value="">— skip —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
          <textarea name="notes" rows={2} className={cls} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/admin/students" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
            Cancel
          </Link>
          <SubmitButton label="Enroll Student" pendingLabel="Enrolling…" />
        </div>
      </form>
    </div>
  )
}
