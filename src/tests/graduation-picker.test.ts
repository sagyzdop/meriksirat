import { describe, expect, it } from 'vitest'
import {
  formatGraduationMonth,
  graduationDateFromPicked,
  graduationPickerDate,
} from '@/lib/graduation-date'

describe('graduation month picker', () => {
  it('stores the first of the chosen month whatever day was clicked', () => {
    expect(graduationDateFromPicked(new Date(2028, 5, 17))).toBe('2028-06-01')
    expect(graduationDateFromPicked(new Date(2028, 11, 31))).toBe('2028-12-01')
  })

  it('clears when nothing is picked', () => {
    expect(graduationDateFromPicked(undefined)).toBe('')
  })

  it('shows a stored date as a month and year', () => {
    expect(formatGraduationMonth('2028-06-01')).toBe('June 2028')
    expect(formatGraduationMonth('2026-12-01')).toBe('December 2026')
    expect(formatGraduationMonth('')).toBe('')
    expect(formatGraduationMonth(null)).toBe('')
  })

  it('opens the picker on the stored month', () => {
    const picked = graduationPickerDate('2028-06-01')
    expect(picked?.getFullYear()).toBe(2028)
    expect(picked?.getMonth()).toBe(5)
    expect(graduationPickerDate(null)).toBeUndefined()
  })

  it('round-trips through the picker', () => {
    expect(graduationDateFromPicked(graduationPickerDate('2029-02-01'))).toBe(
      '2029-02-01'
    )
  })
})
