import { z } from 'zod'

export const UUIDSchema = z.string().uuid()

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export const DateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine(d => d.from <= d.to, { message: 'from must be before to' })

export const BranchIdSchema = z.object({
  branchId: UUIDSchema,
})

export type PaginationInput = z.infer<typeof PaginationSchema>
export type DateRangeInput = z.infer<typeof DateRangeSchema>
