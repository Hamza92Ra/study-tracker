import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { createHash } from 'crypto'
import { getServerSession } from 'next-auth'
import { prisma } from './db'

const WINDOW_MS = 15 * 60 * 1000
async function rateKey(identifier: string) {
  return createHash('sha256').update(identifier.toLowerCase()).digest('hex')
}
async function isBlocked(key: string) {
  const row = await prisma.loginAttempt.findUnique({ where: { key } })
  return !!row && row.attempts >= 5 && Date.now() - row.windowAt.getTime() < WINDOW_MS
}
async function recordFailure(key: string) {
  const now = new Date()
  const row = await prisma.loginAttempt.findUnique({ where: { key } })
  if (!row || Date.now() - row.windowAt.getTime() >= WINDOW_MS) {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, attempts: 1, windowAt: now },
      update: { attempts: 1, windowAt: now, blockedAt: null },
    })
  } else {
    await prisma.loginAttempt.update({
      where: { key },
      data: { attempts: { increment: 1 }, blockedAt: row.attempts >= 4 ? now : null },
    })
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/manage/login' },
  providers: [CredentialsProvider({
    name: 'Study Ledger account',
    credentials: {
      identifier: { label: 'Username or email', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const identifier = credentials?.identifier?.trim().toLowerCase() ?? ''
      const password = credentials?.password ?? ''
      if (!identifier || !password || identifier.length > 255 || password.length > 1024) return null
      const key = await rateKey(identifier)
      if (await isBlocked(key)) return null
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
      })
      if (!user || !user.isActive || !(await compare(password, user.passwordHash))) {
        await recordFailure(key)
        return null
      }
      await prisma.loginAttempt.deleteMany({ where: { key } })
      return {
        id: user.id,
        name: user.displayName,
        email: user.email,
        credentialVersion: user.credentialVersion,
      }
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.ownerId = user.id
        token.credentialVersion = user.credentialVersion
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.ownerId ?? '')
        session.user.credentialVersion = typeof token.credentialVersion === 'number'
          ? token.credentialVersion
          : -1
      }
      return session
    },
  },
}
export const authHandler = NextAuth(authOptions)

// Always re-read account status and credential version from Postgres.
// Deactivation and password reset invalidate already-issued JWT sessions.
export async function currentAccount() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const account = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!account || !account.isActive || account.credentialVersion !== session.user.credentialVersion) return null
  return account
}
export async function requireOwner(options: { allowPasswordChange?: boolean } = {}) {
  const account = await currentAccount()
  if (!account) throw new Error('Unauthorized')
  if (account.mustChangePassword && !options.allowPasswordChange) {
    throw new Error('Change your temporary password before using your workspace.')
  }
  return account
}
export async function requireAdmin() {
  const account = await requireOwner()
  if (account.role !== 'admin') throw new Error('Admin access required')
  return account
}
