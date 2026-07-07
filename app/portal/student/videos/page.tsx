import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import VideoGallery from './VideoGallery'

export default async function MyVideosPage() {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const studentId = (studentRow as any)?.id ?? null

  if (!studentId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[#64748B]">Student record not found.</p>
      </div>
    )
  }

  const { data: portRow } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()

  const portfolioId = (portRow as any)?.id ?? null

  let videos: {
    id: string
    title: string
    description: string
    video_url: string
    category: string
    status: string
    created_at: string
    thumbnail_url: string | null
  }[] = []

  if (portfolioId) {
    const { data } = await db
      .from('portfolio_projects')
      .select('id, title, description, video_url, category, status, created_at, thumbnail_url')
      .eq('portfolio_id', portfolioId)
      .not('video_url', 'is', null)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    videos = ((data ?? []) as any[]).filter((v) => v.video_url)
  }

  return <VideoGallery videos={videos} />
}
