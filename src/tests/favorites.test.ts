import { describe, expect, it } from 'vitest'
import {
  applyFavoriteToggle,
  isPhotoFavorited,
  type FavoriteRef,
} from '../lib/favorites/logic'

const refs: FavoriteRef[] = [{ photoId: 'p1', driveFileId: 'd1' }]

describe('isPhotoFavorited', () => {
  it('matches indexed photos by stable photo id, not Drive id', () => {
    expect(
      isPhotoFavorited({ id: 'moved-drive-id', photoId: 'p1' }, refs)
    ).toBe(true)
    expect(isPhotoFavorited({ id: 'd1', photoId: 'p2' }, refs)).toBe(false)
  })

  it('falls back to the Drive id for unindexed photos', () => {
    expect(isPhotoFavorited({ id: 'd1', photoId: null }, refs)).toBe(true)
    expect(isPhotoFavorited({ id: 'd9' }, refs)).toBe(false)
  })
})

describe('applyFavoriteToggle', () => {
  it('adds a favorite once', () => {
    const photo = { id: 'd2', photoId: 'p2' }
    const next = applyFavoriteToggle(refs, photo, true)
    expect(next).toHaveLength(2)
    expect(applyFavoriteToggle(next, photo, true)).toHaveLength(2)
  })

  it('removes a favorite', () => {
    expect(
      applyFavoriteToggle(refs, { id: 'x', photoId: 'p1' }, false)
    ).toEqual([])
  })

  it('does not mutate its input', () => {
    applyFavoriteToggle(refs, { id: 'd1', photoId: 'p1' }, false)
    expect(refs).toHaveLength(1)
  })
})
