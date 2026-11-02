import { describe, it, expect } from 'vitest'
import { albumPhotoUrls } from '../lib/albums/urls'
import {
  DEFAULT_DAILY_WRITE_BUDGET,
  MAX_PHOTOS_PER_RUN,
  budgetDayKey,
  driveFileToAlbumPhoto,
  driveFileToPhotoValues,
  missingFromTable,
  parseCapturedAt,
  parseDailyWriteBudget,
  photoRowToAlbumPhoto,
  photoWriteCost,
  photosAffordable,
  recordSpend,
  rollBudget,
  selectNextAlbum,
  sortPhotosByCapture,
  sumBytes,
} from '../lib/albums/photo-backfill'
import { chunk } from '../lib/utils'

describe('parseDailyWriteBudget', () => {
  it('defaults to 60k when unset or invalid', () => {
    expect(DEFAULT_DAILY_WRITE_BUDGET).toBe(60_000)
    expect(parseDailyWriteBudget(undefined)).toBe(60_000)
    expect(parseDailyWriteBudget('abc')).toBe(60_000)
    expect(parseDailyWriteBudget('-5')).toBe(60_000)
  })
  it('accepts a number including zero', () => {
    expect(parseDailyWriteBudget('1000')).toBe(1000)
    expect(parseDailyWriteBudget('0')).toBe(0)
  })
})

describe('photosAffordable', () => {
  it('caps by run size on a fresh day', () => {
    expect(photosAffordable(60_000, 0)).toBe(MAX_PHOTOS_PER_RUN)
  })
  it('never exceeds the remaining budget', () => {
    for (const spent of [0, 100, 59_000, 59_990, 59_996, 60_000, 61_000]) {
      const n = photosAffordable(60_000, spent, 100_000)
      expect(spent + photoWriteCost(n)).toBeLessThanOrEqual(
        Math.max(60_000, spent)
      )
    }
  })
  it('returns zero when exhausted', () => {
    expect(photosAffordable(60_000, 60_000)).toBe(0)
    expect(photosAffordable(60_000, 59_997)).toBe(0)
    expect(photosAffordable(0, 0)).toBe(0)
  })
  it('affords exactly what fits', () => {
    expect(photosAffordable(31, 0, 1000)).toBe(10)
  })
})

describe('budget accounting', () => {
  it('uses the UTC date as the day key', () => {
    expect(budgetDayKey(new Date('2026-03-04T23:59:59Z'))).toBe('2026-03-04')
  })
  it('keeps same-day state and resets on a new day', () => {
    const today = { day: '2026-03-04', spent: 500 }
    expect(rollBudget(today, '2026-03-04')).toBe(today)
    expect(rollBudget(today, '2026-03-05')).toEqual({
      day: '2026-03-05',
      spent: 0,
    })
    expect(rollBudget(null, '2026-03-05').spent).toBe(0)
  })
  it('accumulates spend and ignores negatives', () => {
    const s = recordSpend(recordSpend({ day: 'd', spent: 0 }, 31), -5)
    expect(s.spent).toBe(31)
  })
  it('photoWriteCost is 3 per photo plus the totals update', () => {
    expect(photoWriteCost(0)).toBe(0)
    expect(photoWriteCost(10)).toBe(31)
  })
})

describe('selectNextAlbum', () => {
  const c = (id: string, sortTime: number, requestedAt: number | null) => ({
    id,
    sortTime,
    requestedAt,
  })
  it('prefers requested albums, earliest request first', () => {
    const list = [c('new', 300, null), c('r2', 100, 20), c('r1', 50, 10)]
    expect(selectNextAlbum(list)?.id).toBe('r1')
  })
  it('then newest first among the rest', () => {
    const list = [c('old', 100, null), c('new', 300, null), c('mid', 200, null)]
    expect(selectNextAlbum(list)?.id).toBe('new')
  })
  it('skips excluded albums and returns null when none are left', () => {
    const list = [c('a', 1, null), c('b', 2, null)]
    expect(selectNextAlbum(list, new Set(['b']))?.id).toBe('a')
    expect(selectNextAlbum(list, new Set(['a', 'b']))).toBeNull()
    expect(selectNextAlbum([])).toBeNull()
  })
})

describe('missingFromTable', () => {
  it('keeps only unregistered images', () => {
    const files = [
      { id: 'a', name: 'a.jpg', mimeType: 'image/jpeg' },
      { id: 'b', name: 'b.jpg', mimeType: 'image/jpeg' },
      { id: 'c', name: 'c.pdf', mimeType: 'application/pdf' },
    ]
    expect(missingFromTable(files, ['a']).map((f) => f.id)).toEqual(['b'])
  })
  it('is empty once everything is registered', () => {
    const files = [{ id: 'a', name: 'a.jpg', mimeType: 'image/jpeg' }]
    expect(missingFromTable(files, ['a', 'x'])).toEqual([])
  })
})

describe('parseCapturedAt', () => {
  it('parses EXIF and ISO formats', () => {
    expect(parseCapturedAt('2024:05:06 07:08:09')?.toISOString()).toBe(
      '2024-05-06T07:08:09.000Z'
    )
    expect(parseCapturedAt('2024-05-06T07:08:09Z')?.toISOString()).toBe(
      '2024-05-06T07:08:09.000Z'
    )
    expect(parseCapturedAt('nope')).toBeNull()
    expect(parseCapturedAt(undefined)).toBeNull()
  })
})

describe('driveFileToPhotoValues and photoRowToAlbumPhoto', () => {
  const file = {
    id: 'f1',
    name: 'x.jpg',
    mimeType: 'image/jpeg',
    size: '1234',
    createdTime: '2024-01-01T00:00:00Z',
    imageMediaMetadata: {
      time: '2024:01:02 03:04:05',
      cameraMake: 'Sony',
      aperture: 2.8,
      width: 400,
      height: 300,
    },
  }
  it('maps a Drive file to row values', () => {
    const v = driveFileToPhotoValues(file, 'alb', 'p1')
    expect(v).toMatchObject({
      id: 'p1',
      albumId: 'alb',
      driveFileId: 'f1',
      bytes: 1234,
      width: 400,
      height: 300,
    })
    expect(JSON.parse(v.exif!)).toEqual({ cameraMake: 'Sony', aperture: 2.8 })
  })
  it('round-trips into the gallery shape keyed by the Drive file id', () => {
    const photo = photoRowToAlbumPhoto(driveFileToPhotoValues(file, 'a', 'p'))
    expect(photo.id).toBe('f1')
    expect(photo.size).toBe(1234)
    expect(photo.capturedAt).toBe('2024-01-02T03:04:05.000Z')
    expect(photo.createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(photo.exif).toEqual({
      cameraMake: 'Sony',
      aperture: 2.8,
      width: 400,
      height: 300,
    })
  })
  it('handles missing metadata', () => {
    const v = driveFileToPhotoValues(
      { id: 'z', name: 'z.png', mimeType: 'image/png' },
      'a',
      'p',
      new Date('2025-01-01T00:00:00Z')
    )
    expect(v.bytes).toBe(0)
    expect(v.exif).toBeNull()
    const photo = photoRowToAlbumPhoto(v)
    expect(photo.exif).toBeUndefined()
    expect(photo.capturedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})

describe('helpers', () => {
  it('sorts by capture time', () => {
    const mk = (id: string, capturedAt: string) =>
      ({ id, capturedAt }) as Parameters<typeof sortPhotosByCapture>[0][number]
    expect(
      sortPhotosByCapture([mk('b', '2'), mk('a', '1')]).map((p) => p.id)
    ).toEqual(['a', 'b'])
  })
  it('sums bytes and chunks', () => {
    expect(sumBytes([{ bytes: 1 }, { bytes: 2 }])).toBe(3)
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('driveFileToAlbumPhoto', () => {
  const base = { id: 'f1', name: 'a.jpg', mimeType: 'image/jpeg' }

  it('maps a fully described file', () => {
    expect(
      driveFileToAlbumPhoto({
        ...base,
        size: '1234',
        createdTime: '2024-01-02T03:04:05.000Z',
        imageMediaMetadata: {
          time: '2024:01:01 10:00:00',
          cameraMake: 'Canon',
          cameraModel: 'R5',
          exposureTime: '1/100',
          aperture: 2.8,
          focalLength: 35,
          isoSpeed: 100,
          width: 400,
          height: 300,
          whiteBalance: 'Auto',
        },
      })
    ).toEqual({
      id: 'f1',
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 1234,
      capturedAt: '2024-01-01T10:00:00.000Z',
      createdAt: '2024-01-02T03:04:05.000Z',
      url: albumPhotoUrls('f1').url,
      thumbnailUrl: albumPhotoUrls('f1').thumbnailUrl,
      exif: {
        cameraMake: 'Canon',
        cameraModel: 'R5',
        exposureTime: '1/100',
        aperture: 2.8,
        focalLength: 35,
        isoSpeed: 100,
        width: 400,
        height: 300,
        whiteBalance: 'Auto',
      },
    })
  })

  it('falls back to createdTime and omits exif and photoId', () => {
    const photo = driveFileToAlbumPhoto({
      ...base,
      createdTime: '2024-01-02T03:04:05.000Z',
    })
    expect(photo.capturedAt).toBe('2024-01-02T03:04:05.000Z')
    expect(photo.size).toBeNull()
    expect('exif' in photo).toBe(false)
    expect('photoId' in photo).toBe(false)
  })

  it('uses empty strings when no times are known', () => {
    const photo = driveFileToAlbumPhoto(base)
    expect(photo.capturedAt).toBe('')
    expect(photo.createdAt).toBe('')
  })

  it('keeps an empty exif object when metadata is present but empty', () => {
    expect(
      driveFileToAlbumPhoto({ ...base, imageMediaMetadata: {} }).exif
    ).toEqual({})
  })

  it('keeps zero numeric values and drops empty strings', () => {
    expect(
      driveFileToAlbumPhoto({
        ...base,
        imageMediaMetadata: { cameraMake: '', aperture: 0, width: 0 },
      }).exif
    ).toEqual({ aperture: 0, width: 0 })
  })
})
