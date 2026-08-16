import { describe, it, expect } from 'vitest'
import {
  clubLocalToUtc,
  getClubLocalParts,
} from '../lib/booking/operating-hours'

describe('clubLocalToUtc', () => {
  it('converts club wall-clock time to the correct UTC instant (UTC+5)', () => {
    expect(clubLocalToUtc('2026-08-16', '00:00').toISOString()).toBe(
      '2026-08-15T19:00:00.000Z'
    )
    expect(clubLocalToUtc('2026-08-16', '11:00').toISOString()).toBe(
      '2026-08-16T06:00:00.000Z'
    )
    expect(clubLocalToUtc('2026-08-16', '17:00').toISOString()).toBe(
      '2026-08-16T12:00:00.000Z'
    )
    expect(clubLocalToUtc('2026-08-16', '17:30').toISOString()).toBe(
      '2026-08-16T12:30:00.000Z'
    )
    expect(clubLocalToUtc('2026-08-16', '23:59').toISOString()).toBe(
      '2026-08-16T18:59:00.000Z'
    )
  })

  it('is the inverse of getClubLocalParts', () => {
    const cases: Array<[string, string]> = [
      ['2026-08-16', '00:00'],
      ['2026-08-16', '06:15'],
      ['2026-08-16', '17:30'],
      ['2026-01-01', '09:00'],
    ]
    for (const [dateKey, time] of cases) {
      const utc = clubLocalToUtc(dateKey, time)
      const parts = getClubLocalParts(utc)
      expect(parts.dateKey).toBe(dateKey)
      const [h, m] = time.split(':').map(Number)
      expect(parts.minutes).toBe(h * 60 + m)
    }
  })
})
