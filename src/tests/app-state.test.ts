import { describe, expect, it } from 'vitest'
import {
  STATE_PART_CHARS,
  joinStateParts,
  splitStateValue,
} from '@/lib/app-state'

const now = new Date('2026-11-10T10:00:00Z')
const later = new Date(now.getTime() + 1000)

describe('app state parts', () => {
  it('keeps a small value in one part', () => {
    expect(splitStateValue('{"a":1}')).toEqual(['{"a":1}'])
  })

  it('stores an empty value as one empty part', () => {
    expect(splitStateValue('')).toEqual([''])
  })

  it('splits a large value and joins it back unchanged', () => {
    const value = 'я'.repeat(STATE_PART_CHARS * 2 + 7)
    const parts = splitStateValue(value)
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThan(2_000_000)
    }
    expect(
      joinStateParts(
        parts.map((part) => ({ value: part, expiresAt: later })),
        now
      )
    ).toBe(value)
  })

  it('reads nothing when the key is missing', () => {
    expect(joinStateParts([], now)).toBeNull()
  })

  it('reads nothing once the value expired', () => {
    expect(joinStateParts([{ value: 'x', expiresAt: now }], now)).toBeNull()
    expect(joinStateParts([{ value: 'x', expiresAt: later }], now)).toBe('x')
  })
})
