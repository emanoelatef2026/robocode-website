import { redirect } from 'next/navigation'

// Redirect to the new unified payroll page (Phase 20)
export default async function InstructorPayrollPageRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === 'string'))
  ).toString()
  redirect(`/portal/team-leader/payroll${qs ? `?${qs}` : ''}`)
}
