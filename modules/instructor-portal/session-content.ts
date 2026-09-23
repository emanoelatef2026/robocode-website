export function canEditSessionContent(status: string): boolean {
  return status !== 'cancelled' && status !== 'cancelled_with_makeup'
}
