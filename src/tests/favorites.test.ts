import { describe, expect, it } from 'vitest'
import {
  applyFavoriteToggle,
  isPhotoFavorited,
  type FavoriteRef,
} from '../lib/favorites/logic'
import {
  albumsToRead,
  planFavoriteList,
  planRemap,
} from '../lib/favorites/remap'

const refs: FavoriteRef[] = [{ driveFileId: 'd1' }]

describe('isPhotoFavorited', () => {
  it('matches by Drive file id', () => {
    expect(isPhotoFavorited({ id: 'd1' }, refs)).toBe(true)
    expect(isPhotoFavorited({ id: 'd9' }, refs)).toBe(false)
  })
})

describe('applyFavoriteToggle', () => {
  it('adds a favorite once', () => {
    const next = applyFavoriteToggle(refs, { id: 'd2' }, true)
    expect(next).toHaveLength(2)
    expect(applyFavoriteToggle(next, { id: 'd2' }, true)).toHaveLength(2)
  })

  it('removes a favorite', () => {
    expect(applyFavoriteToggle(refs, { id: 'd1' }, false)).toEqual([])
  })

  it('does not mutate its input', () => {
    applyFavoriteToggle(refs, { id: 'd1' }, false)
    expect(refs).toHaveLength(1)
  })
})

describe('planRemap', () => {
  const rows = [
    { userId: 'u1', driveFileId: 'old' },
    { userId: 'u2', driveFileId: 'old' },
    { userId: 'u2', driveFileId: 'new' },
    { userId: 'u3', driveFileId: 'other' },
  ]
  const input = { oldFileId: 'old', newFileId: 'new' }

  it('moves favorites from the old to the new file id', () => {
    const plan = planRemap({ ...input, favorites: rows, coverFileId: 'x' })
    expect(plan.move).toEqual(['u1'])
  })

  it('drops the old row when the user already favorited the new file', () => {
    const plan = planRemap({ ...input, favorites: rows, coverFileId: 'x' })
    expect(plan.drop).toEqual(['u2'])
  })

  it('moves the cover only when it pointed at the old file', () => {
    const base = { ...input, favorites: [] }
    expect(planRemap({ ...base, coverFileId: 'old' }).coverFileId).toBe('new')
    expect(planRemap({ ...base, coverFileId: 'x' }).coverFileId).toBe('x')
    expect(planRemap({ ...base, coverFileId: null }).coverFileId).toBeNull()
  })

  it('does nothing when old and new are the same', () => {
    const plan = planRemap({
      favorites: rows,
      coverFileId: 'old',
      oldFileId: 'old',
      newFileId: 'old',
    })
    expect(plan).toEqual({ move: [], drop: [], coverFileId: 'old' })
  })

  it('is safe to run again after it has been applied', () => {
    const plan = planRemap({
      ...input,
      favorites: [{ userId: 'u1', driveFileId: 'new' }],
      coverFileId: 'new',
    })
    expect(plan).toEqual({ move: [], drop: [], coverFileId: 'new' })
  })
})

describe('planFavoriteList', () => {
  const at = new Date('2026-01-02T00:00:00Z')
  const fav = (albumId: string, driveFileId: string) => ({
    albumId,
    albumTitle: `Album ${albumId}`,
    driveFileId,
    favoritedAt: at,
  })
  const file = { id: 'f1', name: 'a.jpg', mimeType: 'image/jpeg' }

  it('uses listed metadata when the album listing is cached', () => {
    const photos = planFavoriteList({
      favorites: [fav('a', 'f1')],
      listings: { a: { complete: true, files: [file] } },
    })
    expect(photos).toHaveLength(1)
    expect(photos[0]).toMatchObject({
      id: 'f1',
      name: 'a.jpg',
      albumId: 'a',
      albumTitle: 'Album a',
      favoritedAt: at.toISOString(),
    })
  })

  it('shows a placeholder with working URLs when there is no cached listing', () => {
    const photos = planFavoriteList({
      favorites: [fav('a', 'f9')],
      listings: {},
    })
    expect(photos).toHaveLength(1)
    expect(photos[0].id).toBe('f9')
    expect(photos[0].thumbnailUrl).toContain('f9')
  })

  it('omits a favorite whose photo is gone from a complete listing', () => {
    const photos = planFavoriteList({
      favorites: [fav('a', 'gone'), fav('a', 'f1')],
      listings: { a: { complete: true, files: [file] } },
    })
    expect(photos.map((p) => p.id)).toEqual(['f1'])
  })

  it('keeps an unmatched favorite when the listing is incomplete', () => {
    const photos = planFavoriteList({
      favorites: [fav('a', 'maybe')],
      listings: { a: { complete: false, files: [] } },
    })
    expect(photos.map((p) => p.id)).toEqual(['maybe'])
  })
})

describe('albumsToRead', () => {
  it('returns distinct albums in order, capped at the limit', () => {
    const favorites = ['a', 'b', 'c', 'a'].map((albumId) => ({ albumId }))
    expect(albumsToRead(favorites, 2)).toEqual(['a', 'b'])
    expect(albumsToRead(favorites, 10)).toEqual(['a', 'b', 'c'])
  })
})
