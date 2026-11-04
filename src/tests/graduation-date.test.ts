import { describe, expect, it } from 'vitest'
import {
  classOfYear,
  graduationDateError,
  graduationDateFromMonth,
  graduationMonthFromDate,
  legacyYearToGraduationDate,
} from '@/lib/graduation-date'

const NOW = new Date('2026-11-04T12:00:00Z')

describe('month and date conversion', () => {
  it('stores a picked month as the first day of that month', () => {
    expect(graduationDateFromMonth('2027-05')).toBe('2027-05-01')
  })

  it('turns a stored date back into a month input value', () => {
    expect(graduationMonthFromDate('2027-05-01')).toBe('2027-05')
    expect(graduationMonthFromDate(null)).toBe('')
  })

  it('rejects anything that is not a month', () => {
    expect(graduationDateFromMonth('')).toBeNull()
    expect(graduationDateFromMonth('2027')).toBeNull()
    expect(graduationDateFromMonth('2027-13')).toBeNull()
  })

  it('moves an old graduation year to June of that year', () => {
    expect(legacyYearToGraduationDate(2025)).toBe('2025-06-01')
  })
})

describe('class of', () => {
  it('derives the graduation year', () => {
    expect(classOfYear('2027-05-01')).toBe(2027)
  })

  it('is empty when no date is known', () => {
    expect(classOfYear(null)).toBeNull()
    expect(classOfYear('')).toBeNull()
  })
})

describe('graduationDateError', () => {
  it('requires a future date from a flamekeeper', () => {
    expect(
      graduationDateError('2026-06-01', { isFlamekeeper: true }, NOW)
    ).toMatch(/future/)
    expect(
      graduationDateError('2027-06-01', { isFlamekeeper: true }, NOW)
    ).toBeNull()
  })

  it('lets an alumnus enter a past date', () => {
    expect(
      graduationDateError('2019-06-01', { isFlamekeeper: false }, NOW)
    ).toBeNull()
  })

  it('still rejects a malformed date for everyone', () => {
    expect(
      graduationDateError('soon', { isFlamekeeper: false }, NOW)
    ).not.toBeNull()
  })

  it('does not block a flamekeeper who leaves the date unchanged', () => {
    expect(
      graduationDateError(
        '2026-09-01',
        { isFlamekeeper: true, current: '2026-09-01' },
        NOW
      )
    ).toBeNull()
  })
})
