'use server'

import { randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin, requireOwner } from '@/lib/auth'
import { changePasswordSchema, createMemberSchema } from '@/lib/account-validation'
import { assertCanManageAccount, assertCanRevokeAdminAccess } from '@/lib/admin-policy'

const userIdSchema = z.string().min(1).max(128)

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message || 'Invalid input.' }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { ok: false, error: 'Username or email already exists.' }
  }
  if (error instanceof Error && (
    error.message === 'Unauthorized' ||
    error.message === 'Admin access required' ||
    error.message === 'Account not found.' ||
    error.message === 'Change your temporary password before using your workspace.' ||
    error.message === 'At least one active administrator must remain.' ||
    error.message === 'You cannot change your own role, status or password here.' ||
    error.message === 'Only active accounts can be promoted to admin.'
  )) return { ok: false, error: error.message }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return { ok: false, error: 'Account was updated simultaneously. Try again.' }
  }
  return { ok: false, error: 'Unable to complete this action. Try again.' }
}

function refreshUsers() {
  revalidatePath('/manage/admin')
  revalidatePath('/manage')
}

export async function createMember(input: unknown) {
  try {
    await requireAdmin()
    const data = createMemberSchema.parse(input)
    const temporaryPassword = randomBytes(24).toString('base64url')
    const passwordHash = await hash(temporaryPassword, 12)

    await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        displayName: data.displayName,
        passwordHash,
        role: 'member',
        isActive: true,
        mustChangePassword: true,
        settings: {
          create: {
            timezone: 'Africa/Casablanca',
            profileVisibility: 'private',
            themePreference: 'system',
          },
        },
        goal: { create: { dailyTargetMinutes: 180 } },
      },
    })

    refreshUsers()
    // Display once to the admin; never store plaintext or send it by email.
    return { ok: true as const, username: data.username, temporaryPassword }
  } catch (error) {
    return failure(error)
  }
}

// Role and suspension changes run as SERIALIZABLE transactions so concurrent admins
// cannot both demote/suspend the last remaining active administrator.
export async function setAccountRole(userId: string, role: 'admin' | 'member') {
  try {
    const admin = await requireAdmin()
    const id = userIdSchema.parse(userId)
    const nextRole = z.enum(['admin', 'member']).parse(role)

    await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id } })
      if (!target) throw new Error('Account not found.')
      assertCanManageAccount(admin.id, target)
      if (target.role === nextRole) return
      if (nextRole === 'admin' && !target.isActive) throw new Error('Only active accounts can be promoted to admin.')
      if (nextRole === 'member') {
        const count = await tx.user.count({ where: { role: 'admin', isActive: true } })
        assertCanRevokeAdminAccess(target, count)
      }
      await tx.user.update({
        where: { id },
        data: { role: nextRole, credentialVersion: { increment: 1 } },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    refreshUsers()
    return { ok: true as const }
  } catch (error) {
    return failure(error)
  }
}

export async function setMemberStatus(userId: string, active: boolean) {
  try {
    const admin = await requireAdmin()
    const id = userIdSchema.parse(userId)
    const enabled = z.boolean().parse(active)
    await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id } })
      if (!target) throw new Error('Account not found.')
      assertCanManageAccount(admin.id, target)
      if (target.isActive === enabled) return
      if (!enabled) {
        const count = await tx.user.count({ where: { role: 'admin', isActive: true } })
        assertCanRevokeAdminAccess(target, count)
      }
      await tx.user.update({
        where: { id },
        data: { isActive: enabled, credentialVersion: { increment: 1 } },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    refreshUsers()
    return { ok: true as const }
  } catch (error) {
    return failure(error)
  }
}

export async function resetMemberPassword(userId: string) {
  try {
    const admin = await requireAdmin()
    const id = userIdSchema.parse(userId)
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) throw new Error('Account not found.')
    assertCanManageAccount(admin.id, target)

    const temporaryPassword = randomBytes(24).toString('base64url')
    const passwordHash = await hash(temporaryPassword, 12)
    const result = await prisma.user.updateMany({
      where: { id, credentialVersion: target.credentialVersion },
      data: {
        passwordHash,
        mustChangePassword: true,
        credentialVersion: { increment: 1 },
      },
    })
    if (!result.count) return { ok: false as const, error: 'Account changed. Refresh and try again.' }
    refreshUsers()
    return { ok: true as const, temporaryPassword }
  } catch (error) {
    return failure(error)
  }
}

export async function changeOwnPassword(input: unknown) {
  try {
    const account = await requireOwner({ allowPasswordChange: true })
    const data = changePasswordSchema.parse(input)
    const correct = await compare(data.currentPassword, account.passwordHash)
    if (!correct) return { ok: false as const, error: 'Current password is incorrect.' }

    const passwordHash = await hash(data.newPassword, 12)
    await prisma.user.update({
      where: { id: account.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
      },
    })
    revalidatePath('/manage')
    revalidatePath('/manage/settings')
    return { ok: true as const }
  } catch (error) {
    return failure(error)
  }
}
