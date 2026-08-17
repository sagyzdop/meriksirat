import { describe, it, expect } from 'vitest'
import { deriveParentBookingStatus } from '../lib/booking/status'

describe('deriveParentBookingStatus', () => {
  it('returns cancelled when all items are cancelled', () => {
    expect(deriveParentBookingStatus(['cancelled', 'cancelled'])).toBe(
      'cancelled'
    )
  })

  it('returns returned when all items are returned', () => {
    expect(deriveParentBookingStatus(['returned', 'returned'])).toBe('returned')
  })

  it('returns returned when every non-cancelled item was returned', () => {
    expect(deriveParentBookingStatus(['returned', 'cancelled'])).toBe(
      'returned'
    )
    expect(
      deriveParentBookingStatus(['returned', 'cancelled', 'returned'])
    ).toBe('returned')
  })

  it('returns overdue when any item is overdue', () => {
    expect(deriveParentBookingStatus(['returned', 'overdue'])).toBe('overdue')
    expect(deriveParentBookingStatus(['cancelled', 'overdue'])).toBe('overdue')
    expect(deriveParentBookingStatus(['overdue'])).toBe('overdue')
  })

  it('returns partially_returned when some items remain active', () => {
    expect(deriveParentBookingStatus(['returned', 'active'])).toBe(
      'partially_returned'
    )
    expect(deriveParentBookingStatus(['returned', 'booked', 'cancelled'])).toBe(
      'partially_returned'
    )
  })

  it('returns active when items are active with no returns', () => {
    expect(deriveParentBookingStatus(['active'])).toBe('active')
    expect(deriveParentBookingStatus(['active', 'cancelled'])).toBe('active')
  })

  it('returns booked for booked items', () => {
    expect(deriveParentBookingStatus(['booked'])).toBe('booked')
    expect(deriveParentBookingStatus(['booked', 'cancelled'])).toBe('booked')
  })

  it('returns cancelled for an empty booking', () => {
    expect(deriveParentBookingStatus([])).toBe('cancelled')
  })
})
