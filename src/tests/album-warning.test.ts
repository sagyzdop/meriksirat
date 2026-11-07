import { describe, expect, it } from 'vitest'
import { albumStorageWarning } from '../lib/albums/warning'

describe('albumStorageWarning', () => {
  const eventDate = '2024-03-10'

  it('is false at exactly 2 years', () => {
    expect(
      albumStorageWarning(eventDate, new Date('2026-03-10T00:00:00Z'))
    ).toBe(false)
  })

  it('is false 1 day short', () => {
    expect(
      albumStorageWarning(eventDate, new Date('2026-03-09T00:00:00Z'))
    ).toBe(false)
  })

  it('is true 1 day over', () => {
    expect(
      albumStorageWarning(eventDate, new Date('2026-03-11T00:00:00Z'))
    ).toBe(true)
  })

  it('is false for an invalid date', () => {
    expect(albumStorageWarning('nope', new Date())).toBe(false)
  })
})
