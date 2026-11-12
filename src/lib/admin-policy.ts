export type AccountRole = 'admin' | 'member'

export type ManagedAccount = {
  id: string
  role: string
  isActive: boolean
}

export function assertCanManageAccount(actorId: string, target: ManagedAccount) {
  if (actorId === target.id) throw new Error('You cannot change your own role, status or password here.')
}

export function assertCanRevokeAdminAccess(target: ManagedAccount, activeAdminCount: number) {
  if (target.role === 'admin' && target.isActive && activeAdminCount <= 1) {
    throw new Error('At least one active administrator must remain.')
  }
}

export function accountRoleLabel(role: string) {
  return role === 'admin' ? 'Admin' : 'Member'
}
