import { PrismaClient } from '@prisma/client'
import { serverEnv } from './env'

const { DATABASE_URL } = serverEnv()
const connectionUrl = new URL(DATABASE_URL)

// Supavisor transaction pooling (port 6543) does not support Prisma prepared statements.
// Make the requirement explicit without exposing or modifying the saved database secret.
if (connectionUrl.port === '6543' && connectionUrl.hostname.endsWith('.pooler.supabase.com')) {
  connectionUrl.searchParams.set('pgbouncer', 'true')
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: connectionUrl.toString() } },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
