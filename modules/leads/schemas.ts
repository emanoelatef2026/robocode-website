import { z } from 'zod'

export const LEAD_STATUSES = [
  'NEW', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED',
  'TRIAL_ATTENDED', 'FOLLOW_UP', 'CONVERTED', 'LOST',
] as const

export const LEAD_SOURCES = [
  'website', 'facebook_ad', 'instagram_ad',
  'whatsapp', 'referral', 'walk_in', 'other',
] as const

export const createLeadSchema = z.object({
  child_name:         z.string().min(1, 'Child name is required').max(200),
  parent_name:        z.string().max(200).optional().or(z.literal('')),
  phone:              z.string().max(30).optional().or(z.literal('')),
  whatsapp:           z.string().max(30).optional().or(z.literal('')),
  email:              z.string().email().optional().or(z.literal('')),
  age:                z.coerce.number().int().min(1).max(25).optional().or(z.literal('')),
  branch_id:          z.string().uuid().optional().or(z.literal('')),
  interested_course:  z.string().max(200).optional().or(z.literal('')),
  source:             z.enum(LEAD_SOURCES).default('website'),
  notes:              z.string().max(5000).optional().or(z.literal('')),
  assigned_to:        z.string().uuid().optional().or(z.literal('')),
})

export const updateLeadSchema = z.object({
  id:                   z.string().uuid(),
  child_name:           z.string().min(1).max(200).optional(),
  parent_name:          z.string().max(200).optional().or(z.literal('')),
  phone:                z.string().max(30).optional().or(z.literal('')),
  whatsapp:             z.string().max(30).optional().or(z.literal('')),
  email:                z.string().email().optional().or(z.literal('')),
  age:                  z.coerce.number().int().min(1).max(25).optional().or(z.literal('')),
  branch_id:            z.string().uuid().optional().or(z.literal('')),
  interested_course:    z.string().max(200).optional().or(z.literal('')),
  source:               z.enum(LEAD_SOURCES).optional(),
  notes:                z.string().max(5000).optional().or(z.literal('')),
  status:               z.enum(LEAD_STATUSES).optional(),
  assigned_to:          z.string().uuid().optional().or(z.literal('')),
  last_contact_at:      z.string().optional().or(z.literal('')),
  next_follow_up_at:    z.string().optional().or(z.literal('')),
})

export const updateStatusSchema = z.object({
  id:          z.string().uuid(),
  status:      z.enum(LEAD_STATUSES),
  note:        z.string().max(2000).optional().or(z.literal('')),
  lost_reason: z.string().max(1000).optional().or(z.literal('')),
})

export const updateFollowUpSchema = z.object({
  id:                z.string().uuid(),
  next_follow_up_at: z.string().optional().or(z.literal('')),
  last_contact_at:   z.string().optional().or(z.literal('')),
  note:              z.string().max(2000).optional().or(z.literal('')),
})

export const reassignLeadSchema = z.object({
  id:      z.string().uuid(),
  to_user: z.string().uuid('Select an owner'),
  reason:  z.string().max(500).optional().or(z.literal('')),
})

export const convertToStudentSchema = z.object({
  lead_id:         z.string().uuid(),
  email:           z.string().email('Valid email required'),
  password:        z.string().min(6, 'Min 6 characters'),
  first_name:      z.string().min(1, 'First name required'),
  last_name:       z.string().min(1, 'Last name required'),
  branch_id:       z.string().uuid('Branch required'),
  parent_first:    z.string().min(1, 'Parent first name required'),
  parent_last:     z.string().min(1, 'Parent last name required'),
  parent_email:    z.string().email('Valid parent email required'),
  parent_password: z.string().min(6, 'Min 6 characters'),
  parent_phone:    z.string().optional().or(z.literal('')),
})

export const assignToGroupSchema = z.object({
  lead_id:    z.string().uuid(),
  student_id: z.string().uuid(),
  group_id:   z.string().uuid('Select a group'),
})

export type CreateLeadSchema       = z.infer<typeof createLeadSchema>
export type UpdateLeadSchema       = z.infer<typeof updateLeadSchema>
export type UpdateStatusSchema     = z.infer<typeof updateStatusSchema>
export type UpdateFollowUpSchema   = z.infer<typeof updateFollowUpSchema>
export type ReassignLeadSchema     = z.infer<typeof reassignLeadSchema>
export type ConvertToStudentSchema = z.infer<typeof convertToStudentSchema>
export type AssignToGroupSchema    = z.infer<typeof assignToGroupSchema>
