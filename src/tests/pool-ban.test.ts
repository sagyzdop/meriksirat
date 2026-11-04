import { describe, expect, it } from 'vitest'
import { BAN_REASON_MAX, checkBan } from '@/lib/pool/ban'

describe('checkBan', () => {
  it('accepts a reason about someone else and trims it', () => {
    expect(
      checkBan({ actorId: 'a', targetId: 'b', reason: '  deleted  ' })
    ).toEqual({ ok: true, reason: 'deleted' })
  })

  it('refuses banning yourself', () => {
    expect(checkBan({ actorId: 'a', targetId: 'a', reason: 'x' }).ok).toBe(
      false
    )
  })

  it('requires a reason', () => {
    expect(checkBan({ actorId: 'a', targetId: 'b', reason: '   ' }).ok).toBe(
      false
    )
  })

  it('caps the reason length', () => {
    const reason = 'x'.repeat(BAN_REASON_MAX + 1)
    expect(checkBan({ actorId: 'a', targetId: 'b', reason }).ok).toBe(false)
  })
})
