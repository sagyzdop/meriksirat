import { describe, expect, it } from 'vitest'
import { OAUTH_STATE_TTL_MS, isOAuthStateLive } from '@/lib/oauth-state'

describe('OAuth state lifetime', () => {
  const created = new Date('2026-11-10T10:00:00Z')
  const expiresAt = new Date(created.getTime() + OAUTH_STATE_TTL_MS)

  it('lasts ten minutes', () => {
    expect(OAUTH_STATE_TTL_MS).toBe(600_000)
  })

  it('is live until it expires', () => {
    expect(isOAuthStateLive(expiresAt, created)).toBe(true)
    expect(isOAuthStateLive(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(
      true
    )
  })

  it('is dead at and after expiry', () => {
    expect(isOAuthStateLive(expiresAt, expiresAt)).toBe(false)
    expect(isOAuthStateLive(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(
      false
    )
  })
})
