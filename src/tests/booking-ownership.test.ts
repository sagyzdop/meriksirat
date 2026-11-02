import { describe, expect, it } from 'vitest'
import { itemBelongsToBooking, ownsBooking } from '@/lib/booking/ownership'

describe('itemBelongsToBooking', () => {
  it('accepts an item of the same booking', () => {
    expect(itemBelongsToBooking(7, 7)).toBe(true)
  })

  it('refuses an item of another booking', () => {
    expect(itemBelongsToBooking(8, 7)).toBe(false)
  })

  it('refuses a missing item', () => {
    expect(itemBelongsToBooking(undefined, 7)).toBe(false)
    expect(itemBelongsToBooking(null, 7)).toBe(false)
  })
})

describe('ownsBooking', () => {
  it('accepts the owner', () => {
    expect(ownsBooking('u1', 'u1')).toBe(true)
  })

  it('refuses another user', () => {
    expect(ownsBooking('u1', 'u2')).toBe(false)
  })

  it('refuses when either side is missing', () => {
    expect(ownsBooking('u1', null)).toBe(false)
    expect(ownsBooking(undefined, 'u1')).toBe(false)
    expect(ownsBooking('', '')).toBe(false)
  })
})
