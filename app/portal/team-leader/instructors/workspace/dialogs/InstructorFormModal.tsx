'use client'

import { useState, useTransition } from 'react'
import { createInstructorModalAction, updateInstructorModalAction } from '@/modules/instructors/modal-actions'
import { validatePaymentMethodFields } from '@/modules/instructor-payments/types'
import type { FullInstructor, InstructorFormOptions } from '@/modules/instructors/types'
import { FormField } from './FormField'
import { SPECIALIZATIONS_LIST, WORKING_DAYS } from '../types'
import { displayName } from '../utils'

type FormSection = 'basic' | 'account' | 'financial' | 'social' | 'availability'

const SECTIONS: { key: FormSection; label: string }[] = [
  { key: 'basic',        label: 'Basic'        },
  { key: 'account',      label: 'Account'      },
  { key: 'financial',    label: 'Financial'    },
  { key: 'social',       label: 'Social'       },
  { key: 'availability', label: 'Availability' },
]

export function InstructorFormModal({ instructor, options, onClose, onSaved }: {
  instructor:        FullInstructor | null
  options:           InstructorFormOptions
  defaultBranchIds?: string[]
  onClose:           () => void
  onSaved:           (id: string) => void
}) {
  const isEdit = !!instructor
  const [section, setSection]        = useState<FormSection>('basic')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  const [email, setEmail]               = useState(instructor?.user_email ?? '')
  const [password, setPassword]         = useState('')
  const [firstName, setFirstName]       = useState(instructor?.first_name ?? '')
  const [lastName, setLastName]         = useState(instructor?.last_name ?? '')
  const [phone, setPhone]               = useState(instructor?.phone ?? '')
  const [altPhone, setAltPhone]         = useState(instructor?.alt_phone ?? '')
  const [branchIds, setBranchIds]       = useState<string[]>(
    instructor?.branch_ids?.length ? instructor.branch_ids : []
  )
  const [status, setStatus]             = useState<string>(instructor?.status ?? 'active')
  const [employeeId, setEmployeeId]     = useState(instructor?.employee_id ?? '')
  const [hireDate, setHireDate]         = useState(instructor?.hire_date ?? '')
  const [bio, setBio]                   = useState(instructor?.bio ?? '')
  const [instagram, setInstagram]       = useState(instructor?.instagram_url ?? '')
  const [facebook, setFacebook]         = useState(instructor?.facebook_url ?? '')
  const [whatsapp, setWhatsapp]         = useState(instructor?.whatsapp_number ?? '')
  const [salary, setSalary]             = useState(instructor?.salary_per_session?.toString() ?? '')
  const [currency, setCurrency]         = useState(instructor?.currency ?? 'EGP')
  const [paymentMethod, setPaymentMethod] = useState(instructor?.payment_method ?? '')
  const [wallet, setWallet]             = useState(instructor?.wallet_number ?? '')
  const [instapay, setInstapay]         = useState(instructor?.instapay_number ?? '')
  const [paymentLink, setPaymentLink]   = useState(instructor?.payment_link ?? '')
  const [bankAccount, setBankAccount]   = useState(instructor?.bank_account_number ?? '')
  const [paymentNotes, setPaymentNotes] = useState(instructor?.payment_notes ?? '')
  const [specs, setSpecs]               = useState(instructor?.specializations?.join(', ') ?? '')
  const [workingDays, setWorkingDays]   = useState<string[]>(instructor?.working_days ?? [])
  const [maxLoad, setMaxLoad]           = useState(instructor?.max_weekly_load?.toString() ?? '')
  const [internalNotes, setInternalNotes] = useState(instructor?.internal_notes ?? '')

  function toggleBranch(id: string) {
    setBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) { setError('Full name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (branchIds.length === 0) { setError('Select at least one branch.'); return }
    if (paymentMethod) {
      const paymentError = validatePaymentMethodFields({
        payment_method:      paymentMethod,
        wallet_number:       wallet,
        instapay_number:     instapay,
        payment_link:        paymentLink,
        bank_account_number: bankAccount,
      })
      if (paymentError) { setError(paymentError); return }
    }
    setError(null)

    const fd = new FormData()
    if (isEdit) fd.append('id', instructor!.id)
    fd.append('email', email)
    fd.append('first_name', firstName)
    fd.append('last_name', lastName)
    if (password) fd.append('password', password)
    fd.append('phone', phone)
    fd.append('alt_phone', altPhone)
    branchIds.forEach(id => fd.append('branch_ids', id))
    fd.append('status', status)
    fd.append('employee_id', employeeId)
    fd.append('hire_date', hireDate)
    fd.append('bio', bio)
    fd.append('instagram_url', instagram)
    fd.append('facebook_url', facebook)
    fd.append('whatsapp_number', whatsapp)
    fd.append('salary_per_session', salary)
    fd.append('currency', currency)
    fd.append('payment_method', paymentMethod)
    fd.append('wallet_number', wallet)
    fd.append('instapay_number', instapay)
    fd.append('payment_link', paymentLink)
    fd.append('bank_account_number', bankAccount)
    fd.append('payment_notes', paymentNotes)
    fd.append('specializations', specs)
    workingDays.forEach(d => fd.append('working_days', d))
    fd.append('max_weekly_load', maxLoad)
    fd.append('internal_notes', internalNotes)

    startTransition(async () => {
      const res = isEdit ? await updateInstructorModalAction(fd) : await createInstructorModalAction(fd)
      if (res.success) {
        onSaved(isEdit ? instructor!.id : (res.data as { id: string })?.id ?? '')
      } else {
        setError(res.error?.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl h-[95dvh] md:rounded-2xl md:h-[88vh] md:max-w-2xl">
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          <h2 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">
            {isEdit ? `Edit — ${displayName(instructor!.first_name, instructor!.last_name, instructor!.user_email)}` : 'New Instructor'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]">✕</button>
        </div>

        <div className="flex border-b border-[#E2E8F0] px-2 md:px-4 shrink-0 overflow-x-auto">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex-1 md:flex-none px-2 md:px-3 py-2.5 text-[11px] md:text-[12px] font-medium border-b-2 transition whitespace-nowrap text-center ${section === s.key ? 'border-[#FF8A1F] text-[#FF8A1F]' : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-4">
          {section === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" value={firstName} onChange={setFirstName} required />
                <FormField label="Last Name"  value={lastName}  onChange={setLastName}  required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Phone"      value={phone}    onChange={setPhone}    placeholder="+20 1XX XXX XXXX" />
                <FormField label="Alt. Phone" value={altPhone} onChange={setAltPhone} />
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">
                  Branches <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.branches.map(b => {
                    const active = branchIds.includes(b.id)
                    return (
                      <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition ${active ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]'}`}>
                        {b.name}
                      </button>
                    )
                  })}
                </div>
                {branchIds.length === 0 && (
                  <p className="mt-1 text-[11px] text-[#F87171]">Select at least one branch</p>
                )}
                {branchIds.length > 0 && (
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Primary branch: {options.branches.find(b => b.id === branchIds[0])?.name}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
                <FormField label="Employee ID" value={employeeId} onChange={setEmployeeId} />
              </div>
              <FormField label="Hire Date" value={hireDate} onChange={setHireDate} type="date" />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Short instructor biography…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'account' && (
            <>
              <FormField label={`Email${isEdit ? ' (changes login)' : ''}`} type="email" value={email} onChange={setEmail} required />
              <FormField label={isEdit ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={password} onChange={setPassword} placeholder="min. 6 characters" required={!isEdit} />
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">Specializations</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {SPECIALIZATIONS_LIST.map(s => {
                    const active = specs.split(',').map(x => x.trim()).includes(s)
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const cur = specs.split(',').map(x => x.trim()).filter(Boolean)
                          setSpecs(active ? cur.filter(x => x !== s).join(', ') : [...cur, s].join(', '))
                        }}
                        className={`rounded-full px-3 py-1 text-[12px] font-medium border transition ${active ? 'bg-[#FF8A1F] border-[#FF8A1F] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'}`}>
                        {s}
                      </button>
                    )
                  })}
                </div>
                <input value={specs} onChange={e => setSpecs(e.target.value)} placeholder="Or type comma-separated…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] outline-none focus:border-[#FF8A1F]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Internal Notes</label>
                <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={4} placeholder="Private admin notes…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'financial' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Salary per Session" type="number" value={salary} onChange={setSalary} />
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]">
                    <option value="EGP">EGP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Preferred Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]">
                  <option value="">— Select —</option>
                  <option value="vodafone_cash">Vodafone Cash</option>
                  <option value="instapay">Instapay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <FormField label="Instapay Number" value={instapay}      onChange={setInstapay}     placeholder="01X XXXX XXXX" required={paymentMethod === 'instapay'} />
              <FormField label="Instapay Payment Link" value={paymentLink} onChange={setPaymentLink} placeholder="https://ipn.eg/S/..." required={paymentMethod === 'instapay'} />
              {paymentMethod === 'instapay' && (
                <p className="-mt-2 text-[11px] text-[#94A3B8]">Both the Instapay number and payment link are required.</p>
              )}
              <FormField label="Wallet Number"   value={wallet}        onChange={setWallet}       required={paymentMethod === 'vodafone_cash'} />
              <FormField label="Bank Account Number" value={bankAccount} onChange={setBankAccount} required={paymentMethod === 'bank_transfer'} />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Payment Notes</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'social' && (
            <>
              <FormField label="WhatsApp Number" value={whatsapp}  onChange={setWhatsapp}  placeholder="+20 1XX XXX XXXX" />
              <FormField label="Instagram URL"   value={instagram} onChange={setInstagram} placeholder="https://instagram.com/…" />
              <FormField label="Facebook URL"    value={facebook}  onChange={setFacebook}  placeholder="https://facebook.com/…" />
            </>
          )}

          {section === 'availability' && (
            <>
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {WORKING_DAYS.map(d => (
                    <button key={d} type="button"
                      onClick={() => setWorkingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium border transition ${workingDays.includes(d) ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <FormField label="Max Weekly Load (sessions)" type="number" value={maxLoad} onChange={setMaxLoad} />
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          {error ? <p className="text-[12px] text-[#EF4444] flex-1 mr-4">{error}</p> : <div />}
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] px-3 md:px-4 py-2 text-[12px] md:text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">Cancel</button>
            <button onClick={handleSubmit} disabled={isPending}
              className="rounded-lg bg-[#FF8A1F] px-4 md:px-5 py-2 text-[12px] md:text-[13px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition">
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Instructor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
