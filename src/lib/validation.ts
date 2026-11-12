import { z } from 'zod'
import { validTimezone } from './time'
import { usernameSchema } from './account-validation'
export const subjectSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional().default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), icon: z.enum(['book','code','flask','language','pen','brain','chart','music','globe','calculator']).default('book') })
export const sessionSchema = z.object({ subjectId: z.string().min(1), title: z.string().trim().min(1).max(160), notes: z.string().trim().max(5000).optional().default(''), startedAt: z.coerce.date(), endedAt: z.coerce.date(), isPublic: z.boolean().default(true), idempotencyKey: z.string().uuid().optional() }).refine(v => v.endedAt > v.startedAt, 'End must be after start').refine(v => v.endedAt.getTime()-v.startedAt.getTime() <= 24*60*60*1000, 'Sessions cannot exceed 24 hours').refine(v => v.endedAt.getTime() <= Date.now()+5*60*1000, 'Session end cannot be in the future')

// The single-owner profile accepts direct HTTPS images and small, browser-optimized photos.
// Keep the data URL constrained to inert raster formats; never accept SVG or arbitrary data.
const avatarSchema = z.union([
  z.string().url().max(500).refine(value => value.startsWith('https://'), 'Use an HTTPS avatar URL'),
  z.string().max(180_000).regex(/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/, 'Choose a valid image'),
  z.literal(''),
])
export const settingsSchema = z.object({ username: usernameSchema, displayName: z.string().trim().min(1).max(100), biography: z.string().trim().max(500).optional().default(''), studyGoal: z.string().trim().max(240).optional().default(''), avatarUrl: avatarSchema.optional().default(''), timezone: z.string().refine(validTimezone, 'Invalid timezone'), dailyTargetMinutes: z.coerce.number().int().min(1).max(1440), profileVisibility: z.enum(['public','private']), themePreference: z.enum(['system','light','dark']) })
