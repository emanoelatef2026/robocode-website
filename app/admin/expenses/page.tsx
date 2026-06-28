import { redirect } from 'next/navigation'

export default async function ExpensesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const query  = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) query.set(k, v)
  }
  const qs = query.toString()
  redirect(`/admin/finance-center${qs ? `?${qs}` : ''}`)
}
