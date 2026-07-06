import { z } from 'zod'

export const createTeamLeaderSchema = z.object({
  password:            z.string().min(6, 'Password must be at least 6 characters'),
  first_name:          z.string().min(1, 'First name is required').max(100),
  last_name:           z.string().min(1, 'Last name is required').max(100),
  // branch_ids is handled separately via formData.getAll('branch_id') — not in schema
  status:              z.enum(['active', 'inactive']).default('active'),
  phone:               z.string().max(30).optional().or(z.literal('')),
  payment_link:        z.string().max(500).optional().or(z.literal('')),
  wallet_number:       z.string().max(100).optional().or(z.literal('')),
  bank_account_number: z.string().max(100).optional().or(z.literal('')),
})

export const updateTeamLeaderSchema = z.object({
  user_id:             z.string().uuid(),
  first_name:          z.string().min(1).max(100).optional(),
  last_name:           z.string().min(1).max(100).optional(),
  // branch_ids handled separately via formData.getAll('branch_id')
  status:              z.enum(['active', 'inactive']).optional(),
  new_password:        z.string().min(6).optional().or(z.literal('')),
  phone:               z.string().max(30).optional().or(z.literal('')),
  payment_link:        z.string().max(500).optional().or(z.literal('')),
  wallet_number:       z.string().max(100).optional().or(z.literal('')),
  bank_account_number: z.string().max(100).optional().or(z.literal('')),
})

export type CreateTeamLeaderSchema = z.infer<typeof createTeamLeaderSchema>
export type UpdateTeamLeaderSchema = z.infer<typeof updateTeamLeaderSchema>
