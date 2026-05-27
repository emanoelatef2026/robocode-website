import { z } from 'zod'

const CERT_TYPES = ['semester_completion', 'course_completion', 'competition_award', 'achievement', 'custom'] as const

// ─── Template ─────────────────────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  name:                 z.string().min(1).max(200),
  certificate_type:     z.enum(CERT_TYPES),
  description:          z.string().max(1000).optional(),
  background_color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#FFFFFF'),
  accent_color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#FF8A1F'),
  background_image_url: z.string().url().optional().or(z.literal('')),
  logo_url:             z.string().url().optional().or(z.literal('')),
  signatory_name:       z.string().max(100).optional(),
  signatory_title:      z.string().max(100).optional(),
  branch_id:            z.string().uuid().optional().nullable(),
  is_active:            z.boolean().optional().default(true),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

// ─── Certificate ──────────────────────────────────────────────────────────────

export const IssueCertificateSchema = z.object({
  student_id:       z.string().uuid(),
  template_id:      z.string().uuid().optional().nullable(),
  certificate_type: z.enum(CERT_TYPES),
  title:            z.string().min(1).max(300),
  description:      z.string().max(2000).optional(),
  semester_id:      z.string().uuid().optional().nullable(),
  course_id:        z.string().uuid().optional().nullable(),
  achievement_id:   z.string().uuid().optional().nullable(),
  valid_until:      z.string().datetime().optional().nullable(),
  branch_id:        z.string().uuid().optional().nullable(),
})

export const RevokeCertificateSchema = z.object({
  revoke_reason: z.string().min(1).max(500),
})

export type CreateTemplateInput    = z.infer<typeof CreateTemplateSchema>
export type UpdateTemplateInput    = z.infer<typeof UpdateTemplateSchema>
export type IssueCertificateInput  = z.infer<typeof IssueCertificateSchema>
export type RevokeCertificateInput = z.infer<typeof RevokeCertificateSchema>
