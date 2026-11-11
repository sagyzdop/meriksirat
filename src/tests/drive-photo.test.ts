import { describe, it, expect } from 'vitest'
import {
  driveFileToAlbumPhoto,
  driveFileToPhotoDetails,
  parseCapturedAt,
  sortPhotosByCapture,
} from '../lib/albums/drive-photo'

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

describe('helpers', () => {
  it('sorts by capture time', () => {
    const mk = (id: string, capturedAt: string) =>
      ({ id, capturedAt }) as Parameters<typeof sortPhotosByCapture>[0][number]
    expect(
      sortPhotosByCapture([mk('b', '2'), mk('a', '1')]).map((p) => p.id)
    ).toEqual(['a', 'b'])
  })
})

describe('driveFileToAlbumPhoto', () => {
  const base = { id: 'f1', name: 'a.jpg', mimeType: 'image/jpeg' }
  const described = {
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
  }

  it('keeps only what a grid needs', () => {
    expect(driveFileToAlbumPhoto(described)).toEqual({
      id: 'f1',
      name: 'a.jpg',
      capturedAt: '2024-01-01T10:00:00.000Z',
    })
  })

  it('falls back to createdTime', () => {
    const photo = driveFileToAlbumPhoto({
      ...base,
      createdTime: '2024-01-02T03:04:05.000Z',
    })
    expect(photo.capturedAt).toBe('2024-01-02T03:04:05.000Z')
  })

  it('uses an empty string when no times are known', () => {
    expect(driveFileToAlbumPhoto(base).capturedAt).toBe('')
  })
})

describe('driveFileToPhotoDetails', () => {
  const base = { id: 'f1', name: 'a.jpg', mimeType: 'image/jpeg' }

  it('maps size, type and exif', () => {
    expect(
      driveFileToPhotoDetails({
        ...base,
        size: '1234',
        imageMediaMetadata: {
          cameraMake: 'Canon',
          aperture: 2.8,
          width: 400,
          height: 300,
        },
      })
    ).toEqual({
      mimeType: 'image/jpeg',
      size: 1234,
      exif: { cameraMake: 'Canon', aperture: 2.8, width: 400, height: 300 },
    })
  })

  it('has no exif when metadata is missing or empty', () => {
    expect(driveFileToPhotoDetails(base)).toEqual({
      mimeType: 'image/jpeg',
      size: null,
      exif: null,
    })
    expect(
      driveFileToPhotoDetails({ ...base, imageMediaMetadata: {} }).exif
    ).toBeNull()
  })

  it('keeps zero numeric values and drops empty strings', () => {
    expect(
      driveFileToPhotoDetails({
        ...base,
        imageMediaMetadata: { cameraMake: '', aperture: 0, width: 0 },
      }).exif
    ).toEqual({ aperture: 0, width: 0 })
  })
})
