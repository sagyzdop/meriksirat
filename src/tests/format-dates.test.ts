import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatUtcDate } from '@/lib/format'

describe('date formatting', () => {
  it('formats a date in the club timezone', () => {
    expect(formatDate('2026-11-08T20:30:00Z')).toBe('9 Nov 2026')
    expect(formatDate(new Date('2026-11-08T10:00:00Z'))).toBe('8 Nov 2026')
  })

  it('formats a date-time in the club timezone', () => {
    expect(formatDateTime('2026-11-08T11:05:00Z')).toBe('8 Nov 2026, 16:05')
  })

  it('formats date-only values in UTC', () => {
    expect(formatUtcDate('2026-11-08')).toBe('8 Nov 2026')
  })

  it('returns an empty string for empty or invalid input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDate('nope')).toBe('')
  })
})
