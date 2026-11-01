import { describe, it, expect } from 'vitest'
import {
  GB,
  buildDriveAuthUrl,
  decodeIdTokenPayload,
  driveAccountMatches,
  flamekeeperCallbackUrl,
  formatGb,
  gbToBytes,
  hasDriveFileScope,
  isValidGraduationDate,
  isValidPledgeGb,
  pledgeLowerThanUsed,
} from '../lib/flamekeeper/rules'

describe('pledge', () => {
  it('requires at least 1 GB', () => {
    expect(isValidPledgeGb(0.5)).toBe(false)
    expect(isValidPledgeGb(1)).toBe(true)
    expect(isValidPledgeGb(NaN)).toBe(false)
  })

  it('converts GB to bytes and back for display', () => {
    expect(gbToBytes(2)).toBe(2 * GB)
    expect(formatGb(2 * GB)).toBe('2 GB')
    expect(formatGb(1.5 * GB)).toBe('1.5 GB')
  })

  it('detects a pledge lowered below usage', () => {
    expect(pledgeLowerThanUsed(GB, 2 * GB)).toBe(true)
    expect(pledgeLowerThanUsed(2 * GB, 2 * GB)).toBe(false)
  })
})

describe('formatGb for small amounts', () => {
  it('says less than 0.1 GB instead of 0.0 GB', () => {
    expect(formatGb(0)).toBe('0 GB')
    expect(formatGb(1)).toBe('less than 0.1 GB')
    expect(formatGb(0.04 * GB)).toBe('less than 0.1 GB')
    expect(formatGb(0.09 * GB)).toBe('less than 0.1 GB')
    expect(formatGb(0.1 * GB)).toBe('0.1 GB')
  })
})

describe('isValidGraduationDate', () => {
  const now = new Date('2026-11-01T00:00:00Z')

  it('accepts a future ISO date', () => {
    expect(isValidGraduationDate('2027-05-30', now)).toBe(true)
  })

  it('rejects past, malformed and impossible dates', () => {
    expect(isValidGraduationDate('2026-10-01', now)).toBe(false)
    expect(isValidGraduationDate('30/05/2027', now)).toBe(false)
    expect(isValidGraduationDate('2027-02-31', now)).toBe(false)
  })
})

describe('Drive account verification', () => {
  it('requires the same address and the NU domain', () => {
    expect(driveAccountMatches('Jane@nu.edu.kz', 'jane@nu.edu.kz')).toBe(true)
    expect(driveAccountMatches('other@nu.edu.kz', 'jane@nu.edu.kz')).toBe(false)
    expect(driveAccountMatches('jane@gmail.com', 'jane@gmail.com')).toBe(false)
    expect(driveAccountMatches(undefined, 'jane@nu.edu.kz')).toBe(false)
  })

  it('checks the drive.file scope in a granted scope string', () => {
    expect(
      hasDriveFileScope(
        'openid email https://www.googleapis.com/auth/drive.file'
      )
    ).toBe(true)
    expect(hasDriveFileScope('openid email')).toBe(false)
    expect(hasDriveFileScope(undefined)).toBe(false)
  })

  it('decodes the id token payload', () => {
    const payload = btoa(
      JSON.stringify({ email: 'jane@nu.edu.kz', email_verified: true })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeIdTokenPayload(`h.${payload}.s`)?.email).toBe('jane@nu.edu.kz')
    expect(decodeIdTokenPayload('garbage')).toBeNull()
  })
})

describe('buildDriveAuthUrl', () => {
  it('requests only drive.file offline with forced consent', () => {
    const url = new URL(
      buildDriveAuthUrl({
        clientId: 'cid',
        redirectUri: flamekeeperCallbackUrl('http://localhost:3000'),
        state: 'nonce',
        loginHint: 'jane@nu.edu.kz',
      })
    )
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/drive.file openid email'
    )
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('nonce')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/flamekeeper/callback'
    )
  })
})
