import { describe, it, expect } from 'vitest'
import { isInSnowSeason } from '../components/shared/snowfall'

// Local midday, so the assertions hold in any timezone.
const at = (year: number, month: number, day: number) =>
  new Date(year, month, day, 12)

const WINTER = ['01-12', '28-02'] as const
const OCTOBER = ['01-10', '11-11'] as const

describe('isInSnowSeason', () => {
  it('runs inside a window that wraps the year boundary', () => {
    expect(isInSnowSeason(at(2026, 11, 1), ...WINTER)).toBe(true)
    expect(isInSnowSeason(at(2026, 11, 31), ...WINTER)).toBe(true)
    expect(isInSnowSeason(at(2027, 0, 15), ...WINTER)).toBe(true)
    expect(isInSnowSeason(at(2027, 1, 28), ...WINTER)).toBe(true)
  })

  it('stays off either side of a wrapping window', () => {
    expect(isInSnowSeason(at(2026, 10, 30), ...WINTER)).toBe(false)
    expect(isInSnowSeason(at(2027, 2, 1), ...WINTER)).toBe(false)
    expect(isInSnowSeason(at(2027, 5, 15), ...WINTER)).toBe(false)
  })

  it('handles a non-wrapping window like halloween.js', () => {
    expect(isInSnowSeason(at(2026, 9, 1), ...OCTOBER)).toBe(true)
    expect(isInSnowSeason(at(2026, 9, 17), ...OCTOBER)).toBe(true)
    expect(isInSnowSeason(at(2026, 10, 11), ...OCTOBER)).toBe(true)
    expect(isInSnowSeason(at(2026, 10, 12), ...OCTOBER)).toBe(false)
    expect(isInSnowSeason(at(2026, 11, 1), ...OCTOBER)).toBe(false)
  })

  it('clamps 29-02 to 28-02 outside a leap year', () => {
    // 2027 is not a leap year, so the window collapses onto Feb 28 alone.
    expect(isInSnowSeason(at(2027, 1, 28), '29-02', '29-02')).toBe(true)
    expect(isInSnowSeason(at(2027, 1, 27), '29-02', '29-02')).toBe(false)
    expect(isInSnowSeason(at(2028, 1, 29), '29-02', '29-02')).toBe(true)
  })

  it('fails open when a bound is missing or malformed', () => {
    const summer = at(2026, 6, 4)
    expect(isInSnowSeason(summer, undefined, undefined)).toBe(true)
    expect(isInSnowSeason(summer, '01-12', undefined)).toBe(true)
    expect(isInSnowSeason(summer, 'nonsense', '28-02')).toBe(true)
    expect(isInSnowSeason(summer, '31-04', '28-02')).toBe(true)
    expect(isInSnowSeason(summer, '00-12', '28-02')).toBe(true)
    expect(isInSnowSeason(summer, '', '  ')).toBe(true)
  })
})
