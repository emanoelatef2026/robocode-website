import 'server-only'
import { searchPortfolioProjects } from '@/modules/portfolio/queries'
import { searchCertificates } from '@/modules/certificates/queries'
import type { SearchResult } from '@/types/app'

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const q = query.trim()
  const [portfolioResults, certResults] = await Promise.all([
    searchPortfolioProjects(q),
    searchCertificates(q),
  ])

  const results: SearchResult[] = [
    ...portfolioResults.map((p) => ({
      entityType: 'portfolio_project' as const,
      entityId:   p.id,
      title:      p.title,
      subtitle:   [p.student_name, p.course_title].filter(Boolean).join(' · '),
      url:        `/admin/portfolio/${p.student_id}/projects/${p.id}/edit`,
    })),
    ...certResults.map((c) => ({
      entityType: 'certificate' as const,
      entityId:   c.id,
      title:      c.title,
      subtitle:   `${c.recipient_name} · ${c.certificate_code}`,
      url:        `/admin/certificates/${c.id}`,
    })),
  ]

  return results
}
