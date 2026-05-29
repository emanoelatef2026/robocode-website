import { requirePermission } from '@/modules/rbac/guards'
import { listAcademicYears } from '@/modules/academic-years/queries'
import AcademicYearsClient from './AcademicYearsClient'
import Link from 'next/link'

export default async function AcademicYearsPage() {
  await requirePermission('manage_semesters')
  const years = await listAcademicYears()

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0B1F3A]">Academic Years</h1>
          <p className="text-sm text-[#64748B]">Manage the academic year calendar for Robocode.</p>
        </div>
        <Link
          href="/admin/semesters"
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Back to Semesters
        </Link>
      </div>
      <AcademicYearsClient years={years} />
    </div>
  )
}
