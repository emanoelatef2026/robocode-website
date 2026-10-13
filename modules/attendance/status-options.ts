export const CONTRACT_ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
  { value: 'makeup', label: 'Makeup' },
] as const

export type ContractAttendanceStatus = typeof CONTRACT_ATTENDANCE_OPTIONS[number]['value']

export function isContractAttendanceStatus(value: unknown): value is ContractAttendanceStatus {
  return CONTRACT_ATTENDANCE_OPTIONS.some(option => option.value === value)
}
