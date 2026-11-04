import { describe, it, expect } from 'vitest'
import { albumPhotoUrls } from '../lib/albums/urls'
import {
  driveFileToAlbumPhoto,
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
