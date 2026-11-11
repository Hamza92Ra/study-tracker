import { z } from 'zod'
const schema=z.object({DATABASE_URL:z.string().startsWith('postgres'),DIRECT_URL:z.string().startsWith('postgres'),NEXTAUTH_URL:z.url(),NEXTAUTH_SECRET:z.string().min(32),NEXT_PUBLIC_SITE_URL:z.url()})
export function serverEnv(){const result=schema.safeParse(process.env);if(!result.success)throw new Error(`Invalid server environment: ${result.error.issues.map(i=>i.path.join('.')).join(', ')}`);return result.data}
