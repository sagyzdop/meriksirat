import { describe, expect, it } from 'vitest'
import { toDateOnlyString } from '@/lib/format'

describe('toDateOnlyString', () => {
  it('keeps the LOCAL calendar date the user picked', () => {
    // DatePicker emits a Date at local midnight. toDateOnlyString reads the
    // local calendar fields so the stored day never shifts, unlike converting
    // through UTC (toISOString) which loses a day for positive-offset clubs.
    expect(toDateOnlyString(new Date(2006, 5, 2))).toBe('2006-06-02')
    expect(toDateOnlyString(new Date(2005, 4, 4))).toBe('2005-05-04')
    expect(toDateOnlyString(new Date(2005, 9, 29))).toBe('2005-10-29')
  })

  it('zero-pads month and day', () => {
    expect(toDateOnlyString(new Date(2007, 1, 8))).toBe('2007-02-08')
    expect(toDateOnlyString(new Date(2005, 0, 5))).toBe('2005-01-05')
  })
})
