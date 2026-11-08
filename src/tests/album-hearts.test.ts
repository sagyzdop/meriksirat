import { describe, expect, it } from 'vitest'
import {
  adjustHeartCount,
  applyAlbumHeartToggle,
  isAlbumHearted,
  patchHeartCount,
} from '../lib/favorites/logic'

describe('album hearts', () => {
  it('detects a hearted album', () => {
    expect(isAlbumHearted('a', ['a', 'b'])).toBe(true)
    expect(isAlbumHearted('c', ['a', 'b'])).toBe(false)
  })

  it('toggles without duplicating', () => {
    const next = applyAlbumHeartToggle(['a'], 'b', true)
    expect(next).toEqual(['a', 'b'])
    expect(applyAlbumHeartToggle(next, 'b', true)).toEqual(['a', 'b'])
    expect(applyAlbumHeartToggle(next, 'a', false)).toEqual(['b'])
  })

  it('never lets the count go below zero', () => {
    expect(adjustHeartCount(0, -1)).toBe(0)
    expect(adjustHeartCount(2, 1)).toBe(3)
  })

  it('patches matching albums in detail, list and page shapes', () => {
    const a = { id: 'a', heartCount: 1 }
    const b = { id: 'b', heartCount: 5 }
    expect(patchHeartCount(a, 'a', 1)).toEqual({ id: 'a', heartCount: 2 })
    expect(patchHeartCount([a, b], 'a', -1)).toEqual([
      { id: 'a', heartCount: 0 },
      b,
    ])
    const infinite = { pages: [{ albums: [a, b], nextCursor: null }] }
    expect(patchHeartCount(infinite, 'b', 1).pages[0].albums[1]).toEqual({
      id: 'b',
      heartCount: 6,
    })
  })
})
