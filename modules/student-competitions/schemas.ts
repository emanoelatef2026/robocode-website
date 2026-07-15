import { z } from 'zod'

export const createCompetitionSchema = z.object({
  student_id:          z.string().uuid(),
  competition_name:    z.string().min(1, 'Competition name is required'),
  season:              z.string().nullable().optional(),
  year:                z.number().int().min(2000).max(2100),
  role:                z.string().nullable().optional(),
  team_name:           z.string().nullable().optional(),
  coach_instructor_id: z.string().uuid().nullable().optional(),
  branch_id:           z.string().uuid().nullable().optional(),
  project_id:          z.string().uuid().nullable().optional(),
  rank:                z.string().nullable().optional(),
  award:               z.string().nullable().optional(),
  certificate_id:      z.string().uuid().nullable().optional(),
  notes:               z.string().nullable().optional(),
})

export const updateCompetitionSchema = z.object({
  competition_id: z.string().uuid(),
  rank:           z.string().nullable().optional(),
  award:          z.string().nullable().optional(),
  notes:          z.string().nullable().optional(),
})
