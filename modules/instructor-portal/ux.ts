/** User-facing recovery messages. Never expose raw database/runtime details. */
export function instructorError(error: { code?: string; message?: string } | null | undefined, action = 'save your changes'): string {
  const message = error?.message ?? ''
  if (/class changed|resubmit/i.test(message)) return 'Class changed. Ask the assistant to review the latest record and submit their changes again.'
  if (/attendance changed|revision|changed since|newer attendance|out.of.date|stale/i.test(message)) return 'Another instructor updated this class. Reload the latest attendance and review it before saving again.'
  if (/session list changed|already started/i.test(message)) return 'The session list has changed. Refresh the list to continue the open class or request assistant participation.'
  if (/assistant rate/i.test(message)) return 'The assistant rate is not set. Ask your team leader or administrator to set it before approving participation.'
  if (/request assistant participation before/i.test(message)) return 'Request assistant participation from the group page first. Then you can send changes to the lead instructor.'
  if (/lead instructor.*start|start as lead/i.test(message)) return 'The lead instructor needs to start this class first. If you are replacing them, choose Lead instructor.'
  if (/only the lead|lead instructor may|lead instructor can/i.test(message)) return 'Only the lead instructor can do this. Assistants can submit changes for the lead to review.'
  if (/not assigned|no longer assigned|allocation|no access/i.test(message)) return 'Your access to this group needs checking. Contact your team leader, then refresh this page.'
  if (/declined|rejected/i.test(message)) return 'Your participation request was declined. Contact your team leader before trying again.'
  if (/migration|database update|workflow.*required|workflow.*unavailable/i.test(message)) return 'This action is temporarily unavailable. Contact your administrator and try again after the system is updated.'
  if (/topic.*required|enter.*topic|invalid topic/i.test(message)) return 'Enter a session topic, then try again.'
  if (/mark.*attendance|attendance.*every|attendance.*all/i.test(message)) return 'Choose an attendance status for every student before ending the class.'
  if (/https?|valid url|invalid url/i.test(message)) return 'Enter a complete https:// link, then try again.'
  if (/permission|FORBIDDEN/i.test(error?.code ?? '') || /permission required/i.test(message)) return 'You do not have access to this action. Ask your team leader to check your permissions.'
  return `We could not confirm the result. Please try again to ${action} before leaving this screen.`
}

export function recoverInstructorAction<T>(action: (previous: import('@/types/app').ActionResult<T> | null, data: FormData) => Promise<import('@/types/app').ActionResult<T>>) {
  return async (previous: import('@/types/app').ActionResult<T> | null, data: FormData): Promise<import('@/types/app').ActionResult<T>> => {
    try {
      const result = await action(previous, data)
      return result.success ? result : { ...result, error: { ...result.error, message: instructorError(result.error) } }
    } catch { return { success: false, error: { code: 'NETWORK_ERROR', message: instructorError(null) } } }
  }
}

export function needsAttendanceReload(message: string): boolean {
  return /reload the latest attendance/i.test(message)
}
