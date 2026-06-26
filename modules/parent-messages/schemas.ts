import { z } from 'zod'

export const submitParentMessageSchema = z.object({
  category:   z.enum([
    'general_comment', 'suggestion', 'academic_concern',
    'instructor_feedback', 'schedule_request', 'technical_issue', 'other',
  ], { error: 'Category is required.' }),
  message:    z.string().min(10, 'Message must be at least 10 characters.').max(2000),
  student_id: z.string().uuid('Student not specified.'),
})

export const updateMessageStatusSchema = z.object({
  messageId:    z.string().uuid(),
  status:       z.enum(['submitted', 'under_review', 'resolved']),
  internalNote: z.string().max(1000).default(''),
})

export type SubmitParentMessageInput = z.infer<typeof submitParentMessageSchema>
export type UpdateMessageStatusInput = z.infer<typeof updateMessageStatusSchema>
