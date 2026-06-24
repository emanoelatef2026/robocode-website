import { requirePermission } from '@/modules/rbac/guards'
import { listAcademicYears } from '@/modules/academic-years/queries'
import NewSemesterForm from './NewSemesterForm'
import Link from 'next/link'

export default async function NewSemesterPage() {
  await requirePermission('manage_semesters')
  const years = await listAcademicYears()

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Link
          href="/admin/semesters"
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Back
        </Link>
      </div>
      {years.length === 0 ? (
        <div className="ds-card p-8 text-center">
          <p className="text-sm text-[#64748B]">You need an academic year before creating a semester.</p>
          <Link
            href="/admin/semesters/academic-years"
            className="mt-3 inline-block text-sm font-medium text-[#FF8A1F] hover:underline"
          >
            Create academic year →
          </Link>
        </div>
      ) : (
        <NewSemesterForm years={years} />
      )}
    </div>
  )
}
