import { z } from 'zod'

export const SearchQuerySchema = z.object({
  q: z.string().min(2).max(200).trim(),
  entities: z
    .array(
      z.enum([
        'student',
        'instructor',
        'parent',
        'group',
        'course',
        'lesson',
        'assignment',
        'announcement',
        'blog',
      ])
    )
    .optional(),
  branchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
