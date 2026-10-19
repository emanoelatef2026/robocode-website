// Local synthetic preview only. No database or authentication imports.
const notify = (sessionId: string, state: string) => window.dispatchEvent(new CustomEvent('synthetic-shared', { detail: { sessionId, state } }))
export async function changeParticipation(sessionId: string, mode: string, _reason?: string) {
  await new Promise(resolve => setTimeout(resolve, 300))
  const state = mode === 'join' ? 'joined' : mode === 'request' ? 'requested' : 'confirmed'
  notify(sessionId, state)
  return { success: true as const, data: { sessionId, groupId: 'synthetic-group', state } }
}
export async function openSharedSession(_course: string, expected: string | null, _previous: string | null, _topic: string) {
  const sessionId = expected ?? 'synthetic-next'
  return { success: true as const, data: { sessionId, groupId: 'synthetic-group' } }
}
export async function reviewParticipation(sessionId: string, _instructor: string, approve: boolean) {
  return { success: true as const, data: { sessionId, groupId: 'synthetic-group', state: approve ? 'confirmed' : 'rejected' } }
}
