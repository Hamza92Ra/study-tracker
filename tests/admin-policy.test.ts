import { describe, expect, it } from 'vitest'
import { assertCanManageAccount, assertCanRevokeAdminAccess, accountRoleLabel } from '../src/lib/admin-policy'

describe('administrator management safeguards', () => {
  const admin = { id: 'a', role: 'admin', isActive: true }
  const member = { id: 'b', role: 'member', isActive: true }
  it('prevents updating own role, status or password through People', () => {
    expect(() => assertCanManageAccount('a', admin)).toThrow(/your own/)
    expect(() => assertCanManageAccount('a', member)).not.toThrow()
  })
  it('protects the final active administrator', () => {
    expect(() => assertCanRevokeAdminAccess(admin, 1)).toThrow(/At least one active administrator/)
    expect(() => assertCanRevokeAdminAccess(admin, 2)).not.toThrow()
    expect(() => assertCanRevokeAdminAccess(member, 1)).not.toThrow()
  })
  it('does not count suspended admins as active', () => {
    expect(() => assertCanRevokeAdminAccess({ ...admin, isActive: false }, 1)).not.toThrow()
  })
  it('keeps role labels clear for the People dashboard', () => {
    expect(accountRoleLabel('admin')).toBe('Admin')
    expect(accountRoleLabel('member')).toBe('Member')
  })
})
