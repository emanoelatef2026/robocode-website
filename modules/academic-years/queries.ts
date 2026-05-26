import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { AcademicYear, AcademicYearListItem } from './types'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

export async function listAcademicYears(): Promise<AcademicYearListItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('academic_years')
    .select('id, name, start_date, end_date, is_current')
    .eq('org_id', DEFAULT_ORG)
    .order('start_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AcademicYearListItem[]
}

export async function getAcademicYear(id: string): Promise<AcademicYear | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('academic_years')
    .select('*')
    .eq('id', id)
    .eq('org_id', DEFAULT_ORG)
    .single()

  if (error || !data) return null
  return data as AcademicYear
}

export async function getCurrentAcademicYear(): Promise<AcademicYearListItem | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('academic_years')
    .select('id, name, start_date, end_date, is_current')
    .eq('org_id', DEFAULT_ORG)
    .eq('is_current', true)
    .maybeSingle()

  return data as AcademicYearListItem | null
}
