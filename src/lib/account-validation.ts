import { z } from 'zod'

export const createMemberSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,32}$/, 'Use 3–32 lowercase letters, numbers, _ or -.'),
  email: z.email().trim().toLowerCase().max(254),
  displayName: z.string().trim().min(1, 'Display name is required').max(100),
})
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(12, 'New password must be at least 12 characters.').max(128),
}).refine(value => value.currentPassword !== value.newPassword, {
  message: 'Choose a different new password.',
  path: ['newPassword'],
})
