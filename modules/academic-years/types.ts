export interface AcademicYear {
  id: string
  org_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface AcademicYearListItem {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}
