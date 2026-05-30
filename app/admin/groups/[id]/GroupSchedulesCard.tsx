'use client'

import { useActionState, useTransition } from 'react'
import { createGroupSchedule, deleteGroupSchedule } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { GroupScheduleItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface Props {
  groupId:     string
  hasCourse:   boolean
  schedules:   GroupScheduleItem[]
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const TYPE_LABELS: Record<string, string> = {
  regular: 'Regular', makeup: 'Makeup', exam: 'Exam', event: 'Event',
}

export default function GroupSchedulesCard({ groupId, hasCourse, schedules }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createGroupSchedule, null
  )
  const [isPending, startTransition] = useTransition()

  const handleDelete = (scheduleId: string) => {
    if (!confirm('Cancel this scheduled session?')) return
    startTransition(async () => {
      await deleteGroupSchedule(scheduleId, groupId)
    })
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15 bg-white'

  // Default scheduled_at: tomorrow same time as now
  const tomorrow = new Date(Date.now() + 86_400_000)
  tomorrow.setMinutes(0, 0, 0)
  const defaultDt = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Schedule Management</h2>

      {!hasCourse ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          Assign a course first to enable session scheduling.
        </div>
      ) : (
        <>
          {/* Add schedule form */}
          <div className="mb-5 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Add Session</p>

            {state && !state.success && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error.message}
              </div>
            )}
            {state?.success && (
              <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                Session scheduled. Instructor can start it from their portal.
              </div>
            )}

            <form action={action} className="space-y-3">
              <input type="hidden" name="group_id" value={groupId} />

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Date & Time</label>
                  <input
                    type="datetime-local"
                    name="scheduled_at"
                    required
                    defaultValue={defaultDt}
                    className={cls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Duration (min)</label>
                  <input
                    type="number"
                    name="duration_minutes"
                    defaultValue={90}
                    min={15}
                    max={480}
                    required
                    className={cls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Type</label>
                  <select name="type" defaultValue="regular" className={cls}>
                    <option value="regular">Regular</option>
                    <option value="makeup">Makeup</option>
                    <option value="exam">Exam</option>
                    <option value="event">Event</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Delivery</label>
                  <select name="delivery" defaultValue="offline" className={cls}>
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Topic (optional)</label>
                  <input type="text" name="topic" placeholder="e.g. Intro to Variables" className={cls} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Room (optional)</label>
                  <input type="text" name="room" placeholder="Room 3A" className={cls} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Meeting URL (optional)</label>
                  <input type="url" name="meeting_url" placeholder="https://meet.google.com/…" className={cls} />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <SubmitButton label="Add Session" />
              </div>
            </form>
          </div>

          {/* Sessions list */}
          {schedules.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#94A3B8]">No sessions scheduled yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748B]">Date & Time</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748B]">Duration</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748B]">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748B]">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748B]">Topic</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 text-[#0B1F3A]">
                        <p className="font-medium">
                          {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          {new Date(s.scheduled_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{s.duration_minutes} min</td>
                      <td className="px-4 py-3 text-[#64748B] capitalize">{TYPE_LABELS[s.type] ?? s.type}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        <span className="block max-w-[160px] truncate">{s.topic ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={isPending}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
