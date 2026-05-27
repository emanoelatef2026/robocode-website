import 'server-only'
import { searchPortfolioProjects } from '@/modules/portfolio/queries'
import type { SearchResult } from '@/types/app'

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const portfolioResults = await searchPortfolioProjects(query.trim())

  const results: SearchResult[] = portfolioResults.map((p) => ({
    entityType: 'portfolio_project',
    entityId:   p.id,
    title:      p.title,
    subtitle:   [p.student_name, p.course_title].filter(Boolean).join(' · '),
    url:        `/admin/portfolio/${p.student_id}/projects/${p.id}/edit`,
  }))

  return results
}
