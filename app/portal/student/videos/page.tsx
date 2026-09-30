import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import VideoGallery from './VideoGallery'

export default async function MyVideosPage() {
  const user = await requirePortalRole('student')
  const db = createServiceClient()
  const { data: student } = await db.from('students').select('id').eq('user_id', user.id).is('deleted_at', null).maybeSingle()
  const studentId = (student as { id?: string } | null)?.id
  if (!studentId) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#64748B]">Student record not found.</div>
  const { data } = await db.from('student_videos').select('id, title, description, youtube_url, thumbnail_url, format, created_at').eq('student_id', studentId).order('created_at', { ascending: false })
  return <VideoGallery videos={(data ?? []) as never[]} />
}
