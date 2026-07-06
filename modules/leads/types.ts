export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'TRIAL_BOOKED'
  | 'TRIAL_ATTENDED'
  | 'FOLLOW_UP'
  | 'CONVERTED'
  | 'LOST'

export type LeadSource =
  | 'website'
  | 'facebook_ad'
  | 'instagram_ad'
  | 'whatsapp'
  | 'referral'
  | 'walk_in'
  | 'other'

export interface Lead {
  id:                   string
  child_name:           string
  parent_name:          string | null
  phone:                string | null
  whatsapp:             string | null
  email:                string | null
  age:                  number | null
  branch_id:            string | null
  interested_course:    string | null
  source:               LeadSource
  notes:                string | null
  status:               LeadStatus
  assigned_to:          string | null
  assigned_at:          string | null
  stage_entered_at:     string | null
  lost_reason:          string | null
  converted_student_id: string | null
  last_contact_at:      string | null
  next_follow_up_at:    string | null
  created_at:           string
  updated_at:           string
  // joined
  branch_name?:         string | null
  assigned_name?:       string | null
  days_in_stage?:       number
}

export interface LeadListItem {
  id:                string
  child_name:        string
  parent_name:       string | null
  phone:             string | null
  whatsapp:          string | null
  age:               number | null
  source:            LeadSource
  status:            LeadStatus
  branch_id:         string | null
  branch_name:       string | null
  assigned_to:       string | null
  assigned_name:     string | null
  days_in_stage:     number
  next_follow_up_at: string | null
  created_at:        string
}

export interface LeadKPIs {
  total:            number
  new_leads:        number
  contacted:        number
  trial_booked:     number
  trial_attended:   number
  converted:        number
  conversion_rate:  number
  follow_ups_today: number
}

export interface OwnershipKPIs {
  my_leads:              number
  unassigned:            number
  overdue_follow_ups:    number
  converted_this_month:  number
  my_conversion_rate:    number
}

export interface AgingLead {
  id:           string
  child_name:   string
  status:       LeadStatus
  assigned_to:  string | null
  assigned_name: string | null
  days_in_stage: number
  phone:        string | null
}

export interface FollowUpDueLead {
  id:               string
  child_name:       string
  phone:            string | null
  assigned_to:      string | null
  assigned_name:    string | null
  next_follow_up_at: string
  status:           LeadStatus
  days_overdue:     number
}

export interface OwnerWorkload {
  user_id:         string | null
  name:            string
  total:           number
  active:          number
  converted:       number
  conversion_rate: number
}

export interface LeadTimelineEvent {
  id:              string
  lead_id:         string
  event_type:      string
  note:            string | null
  created_by:      string | null
  created_by_name: string | null
  created_at:      string
}

export interface BranchTeamMember {
  user_id: string
  name:    string
}

// Aging thresholds in days per status
export const AGING_THRESHOLDS: Partial<Record<LeadStatus, number>> = {
  NEW:          2,
  CONTACTED:    3,
  TRIAL_BOOKED: 7,
  FOLLOW_UP:    5,
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW:            'bg-[#EFF6FF]  text-[#1D4ED8]',
  CONTACTED:      'bg-yellow-100 text-yellow-700',
  INTERESTED:     'bg-purple-100 text-purple-700',
  TRIAL_BOOKED:   'bg-indigo-100 text-indigo-700',
  TRIAL_ATTENDED: 'bg-cyan-100   text-cyan-700',
  FOLLOW_UP:      'bg-orange-100 text-orange-700',
  CONVERTED:      'bg-[#E7F8EE]  text-[#15803D]',
  LOST:           'bg-[#FEE2E2]  text-[#DC2626]',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website:      'Website',
  facebook_ad:  'Facebook Ad',
  instagram_ad: 'Instagram Ad',
  whatsapp:     'WhatsApp',
  referral:     'Referral',
  walk_in:      'Walk-In',
  other:        'Other',
}
