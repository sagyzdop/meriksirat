import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken } from '@/lib/buffer/crypto'
import {
  BUFFER_SCOPE,
  canRetire,
  hasFullDriveScope,
  isBufferEmail,
  needsMigration,
  planConnect,
  refuseBufferAccount,
  stateForError,
} from '@/lib/buffer/grant-rules'
import { planBufferSource } from '@/lib/buffer/plan'
import { volumeFolderName } from '@/lib/pool/volumes'
import {
  DriveAuthError,
  DriveQuotaExceededError,
} from '@/lib/google/google-drive'

describe('token encryption', () => {
  it('round-trips and rejects a wrong key', async () => {
    const stored = await encryptToken('1//refresh', 'secret-a')
    expect(stored).not.toContain('refresh')
    expect(await decryptToken(stored, 'secret-a')).toBe('1//refresh')
    await expect(decryptToken(stored, 'secret-b')).rejects.toThrow()
  })

  it('refuses an empty key', async () => {
    await expect(encryptToken('x', ' ')).rejects.toThrow('not set')
  })
})

describe('connect rules', () => {
  it('needs the full drive scope', () => {
    expect(hasFullDriveScope(`openid ${BUFFER_SCOPE}`)).toBe(true)
    expect(
      hasFullDriveScope('https://www.googleapis.com/auth/drive.file')
    ).toBe(false)
    expect(hasFullDriveScope(undefined)).toBe(false)
  })

  it('refuses the master, registered users and flamekeepers', () => {
    const base = {
      email: 'a@x.com',
      masterEmail: 'master@x.com',
      isRegisteredUser: false,
      isFlamekeeper: false,
    }
    expect(refuseBufferAccount(base)).toBeNull()
    expect(refuseBufferAccount({ ...base, email: 'MASTER@x.com' })).toBe(
      'master'
    )
    expect(refuseBufferAccount({ ...base, isRegisteredUser: true })).toBe(
      'user'
    )
    expect(refuseBufferAccount({ ...base, isFlamekeeper: true })).toBe(
      'flamekeeper'
    )
  })

  it('plans replace, adopt and pending', () => {
    const legacyEmail = 'old@gmail.com'
    expect(
      planConnect({
        email: 'OLD@gmail.com',
        active: { email: 'old@gmail.com' },
        legacyEmail,
      })
    ).toEqual({ kind: 'replace-active' })
    expect(
      planConnect({ email: 'old@gmail.com', active: null, legacyEmail })
    ).toEqual({ kind: 'adopt-legacy' })
    expect(
      planConnect({ email: 'new@gmail.com', active: null, legacyEmail })
    ).toEqual({ kind: 'pending' })
    expect(
      planConnect({
        email: 'new@gmail.com',
        active: { email: 'old@gmail.com' },
        legacyEmail,
      })
    ).toEqual({ kind: 'pending' })
  })

  it('matches buffer emails case-insensitively', () => {
    expect(isBufferEmail('A@x.com', ['b@x.com', 'a@X.com'])).toBe(true)
    expect(isBufferEmail('', ['a@x.com'])).toBe(false)
  })
})

describe('switch rules', () => {
  it('migrates volumes held by any other grant, or none', () => {
    expect(needsMigration(null, 'new')).toBe(true)
    expect(needsMigration('old', 'new')).toBe(true)
    expect(needsMigration('new', 'new')).toBe(false)
  })

  it('retires only after the window with no volumes left', () => {
    const now = new Date('2026-01-10')
    const grant = {
      status: 'retiring' as const,
      retireAfter: new Date('2026-01-09'),
    }
    expect(canRetire(grant, 0, now)).toBe(true)
    expect(canRetire(grant, 2, now)).toBe(false)
    expect(
      canRetire({ ...grant, retireAfter: new Date('2026-01-11') }, 0, now)
    ).toBe(false)
    expect(canRetire({ ...grant, status: 'pending' as never }, 0, now)).toBe(
      false
    )
  })
})

describe('loss handling', () => {
  it('maps errors to buffer states', () => {
    expect(
      stateForError(new Error('Failed to refresh buffer access token: x'))
    ).toBe('auth_failed')
    expect(stateForError(new DriveAuthError())).toBe('auth_failed')
    expect(stateForError(new DriveQuotaExceededError())).toBe('quota_full')
    expect(stateForError(new Error('boom'))).toBeNull()
  })

  it('stops uploads when the active grant lost access', () => {
    const env = { GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' }
    const ok = planBufferSource({
      env,
      active: { id: 'g1', email: 'b@x.com', state: 'ok' },
    })
    expect(ok).toEqual({ kind: 'buffer', email: 'b@x.com', grantId: 'g1' })
    const lost = planBufferSource({
      env,
      active: { id: 'g1', email: 'b@x.com', state: 'auth_failed' },
    })
    expect(lost.kind).toBe('unavailable')
  })

  it('falls back to the env tokens when no grant is stored', () => {
    const plan = planBufferSource({
      env: {
        GOOGLE_CLIENT_ID: 'a',
        GOOGLE_CLIENT_SECRET: 'b',
        GOOGLE_BUFFER_REFRESH_TOKEN: 't',
      },
      active: null,
    })
    expect(plan).toMatchObject({ kind: 'buffer', grantId: null })
  })
})

describe('volume names', () => {
  it('sort in volume order', () => {
    const names = [10, 2, 1].map((n) => volumeFolderName(n, 'zzzzzz'))
    expect([...names].sort()).toEqual(['V01zzzzzz', 'V02zzzzzz', 'V10zzzzzz'])
  })
})
