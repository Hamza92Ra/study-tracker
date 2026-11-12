import { describe, expect, it } from 'vitest'
import { changePasswordSchema, createMemberSchema } from '../src/lib/account-validation'

describe('member account validation', () => {
  it('normalizes a new member username and email', () => {
    expect(createMemberSchema.parse({
      username: '  STUDENT_7  ',
      email: '  Person@Example.COM  ',
      displayName: ' Student Seven ',
    })).toEqual({
      username: 'student_7',
      email: 'person@example.com',
      displayName: 'Student Seven',
    })
  })

  it('rejects invalid usernames and email addresses', () => {
    expect(createMemberSchema.safeParse({ username: 'x', email: 'a@b.com', displayName: 'A' }).success).toBe(false)
    expect(createMemberSchema.safeParse({ username: 'valid_user', email: 'not-email', displayName: 'A' }).success).toBe(false)
  })

  it('requires a new password of at least twelve characters', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'oldPass123456', newPassword: 'short' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'oldPass123456', newPassword: 'oldPass123456' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'oldPass123456', newPassword: 'newLongPass123456' }).success).toBe(true)
  })
})
