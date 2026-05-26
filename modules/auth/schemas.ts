import { z } from 'zod'

export const MagicLinkSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
})

export const SignInWithPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type MagicLinkInput = z.infer<typeof MagicLinkSchema>
export type SignInWithPasswordInput = z.infer<typeof SignInWithPasswordSchema>
