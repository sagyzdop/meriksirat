import { describe, it, expect } from 'vitest'
import { excludeOwnBookingPeriod } from '../lib/booking/availability'

describe('excludeOwnBookingPeriod', () => {
  it('excludes the booking’s own event from the free/busy result', () => {
    const busy = [
      { start: '2026-08-01T09:00:00Z', end: '2026-08-01T11:00:00Z' },
    ]
    const result = excludeOwnBookingPeriod(
      busy,
      '2026-08-01T08:00:00Z',
      '2026-08-01T12:00:00Z'
    )
    expect(result).toEqual([])
  })

  it('excludes the own event when it is fully inside the current window', () => {
    const busy = [
      { start: '2026-08-01T09:00:00Z', end: '2026-08-01T10:00:00Z' },
    ]
    const result = excludeOwnBookingPeriod(
      busy,
      '2026-08-01T08:00:00Z',
      '2026-08-01T12:00:00Z'
    )
    expect(result).toEqual([])
  })

  it('keeps genuine conflicts with other bookings', () => {
    const busy = [
      { start: '2026-08-01T09:00:00Z', end: '2026-08-01T11:00:00Z' },
    ]
    const result = excludeOwnBookingPeriod(
      busy,
      '2026-08-01T13:00:00Z',
      '2026-08-01T14:00:00Z'
    )
    expect(result).toEqual(busy)
  })

  it('keeps other conflicts alongside the own event', () => {
    const busy = [
      { start: '2026-08-01T09:00:00Z', end: '2026-08-01T11:00:00Z' },
      { start: '2026-08-01T13:00:00Z', end: '2026-08-01T14:00:00Z' },
    ]
    const result = excludeOwnBookingPeriod(
      busy,
      '2026-08-01T08:00:00Z',
      '2026-08-01T12:00:00Z'
    )
    expect(result).toEqual([busy[1]])
  })

  it('accepts Date objects for the own period', () => {
    const busy = [
      { start: '2026-08-01T09:00:00Z', end: '2026-08-01T11:00:00Z' },
    ]
    const result = excludeOwnBookingPeriod(
      busy,
      new Date('2026-08-01T08:00:00Z'),
      new Date('2026-08-01T12:00:00Z')
    )
    expect(result).toEqual([])
  })
})
