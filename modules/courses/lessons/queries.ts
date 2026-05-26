import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Lesson, LessonListItem } from './types'

export async function listLessons(moduleId: string): Promise<LessonListItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('lessons')
    .select('id, module_id, title, type, order_index, duration_minutes, is_published, video_url')
    .eq('module_id', moduleId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id:               row.id,
    module_id:        row.module_id,
    title:            row.title,
    type:             row.type,
    order_index:      row.order_index,
    duration_minutes: row.duration_minutes ?? null,
    is_published:     row.is_published,
    video_url:        row.video_url ?? null,
  }))
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('lessons')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as Lesson
}

export async function getNextLessonOrder(moduleId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('lessons')
    .select('order_index')
    .eq('module_id', moduleId)
    .is('deleted_at', null)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? 0) + 1
}
