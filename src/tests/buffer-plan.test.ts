import { describe, expect, it } from 'vitest'
import {
  BUFFER_FULL_MESSAGE,
  BUFFER_OWNER_ID,
  BUFFER_UNAVAILABLE_MESSAGE,
  bufferUploadMessage,
  decideMissingVolumeFolder,
  planBufferUpload,
  planVolumeSetup,
} from '@/lib/buffer/plan'
import {
  DriveAuthError,
  DriveNotFoundError,
  DriveQuotaExceededError,
} from '@/lib/google/google-drive'

const READY = {
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_BUFFER_REFRESH_TOKEN: 'refresh',
}

describe('planBufferUpload', () => {
  it('sends uploads to the buffer, defaulting its email', () => {
    expect(planBufferUpload(READY)).toEqual({
      kind: 'buffer',
      email: 'nuimage.storage@gmail.com',
    })
  })

  it('uses a configured buffer email, trimmed', () => {
    expect(
      planBufferUpload({ ...READY, GOOGLE_BUFFER_EMAIL: ' club@gmail.com ' })
    ).toEqual({ kind: 'buffer', email: 'club@gmail.com' })
  })

  it('does not need the full-scope token for uploads', () => {
    expect(planBufferUpload(READY).kind).toBe('buffer')
  })

  it('refuses the upload when the upload token is missing', () => {
    expect(
      planBufferUpload({ ...READY, GOOGLE_BUFFER_REFRESH_TOKEN: undefined })
    ).toEqual({
      kind: 'unavailable',
      message: BUFFER_UNAVAILABLE_MESSAGE,
      missing: ['GOOGLE_BUFFER_REFRESH_TOKEN'],
    })
  })

  it('lists every missing setting, treating blanks as missing', () => {
    const plan = planBufferUpload({ GOOGLE_BUFFER_REFRESH_TOKEN: ' ' })
    expect(plan.kind).toBe('unavailable')
    if (plan.kind === 'unavailable') {
      expect(plan.missing).toEqual([
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_BUFFER_REFRESH_TOKEN',
      ])
    }
  })

  it('never names a flamekeeper as a fallback', () => {
    const plan = planBufferUpload({})
    expect(plan.kind).toBe('unavailable')
    expect(plan).not.toHaveProperty('userId')
  })
})

describe('planVolumeSetup', () => {
  it('creates and shares the folder for a first upload', () => {
    expect(planVolumeSetup(null)).toEqual({ create: true, share: true })
  })

  it('shares an existing folder that was never shared', () => {
    expect(planVolumeSetup({ driveFolderId: 'f1', permissionId: '' })).toEqual({
      create: false,
      share: true,
    })
  })

  it('does nothing once the folder exists and is shared', () => {
    expect(
      planVolumeSetup({ driveFolderId: 'f1', permissionId: 'p1' })
    ).toEqual({ create: false, share: false })
  })

  it('recreates a forgotten folder', () => {
    expect(
      planVolumeSetup({ driveFolderId: null, permissionId: 'p1' })
    ).toEqual({ create: true, share: true })
  })
})

describe('decideMissingVolumeFolder', () => {
  it('recreates an empty volume whose folder is gone', () => {
    expect(
      decideMissingVolumeFolder({ hasPhotos: false, retried: false })
    ).toBe('recreate')
  })

  it('keeps the volume when it still has photos', () => {
    expect(decideMissingVolumeFolder({ hasPhotos: true, retried: false })).toBe(
      'fail'
    )
  })

  it('gives up after one retry', () => {
    expect(decideMissingVolumeFolder({ hasPhotos: false, retried: true })).toBe(
      'fail'
    )
  })
})

describe('bufferUploadMessage', () => {
  it('says the buffer is full on a Drive quota error', () => {
    expect(bufferUploadMessage(new DriveQuotaExceededError())).toBe(
      BUFFER_FULL_MESSAGE
    )
  })

  it('says storage is unavailable when the buffer token is rejected', () => {
    expect(bufferUploadMessage(new DriveAuthError())).toBe(
      BUFFER_UNAVAILABLE_MESSAGE
    )
  })

  it('says storage is unavailable when the token cannot be refreshed', () => {
    expect(
      bufferUploadMessage(new Error('Failed to refresh buffer access token: x'))
    ).toBe(BUFFER_UNAVAILABLE_MESSAGE)
  })

  it('leaves other errors alone', () => {
    expect(bufferUploadMessage(new DriveNotFoundError())).toBeNull()
    expect(bufferUploadMessage(new Error('boom'))).toBeNull()
  })
})

describe('BUFFER_OWNER_ID', () => {
  it('marks buffer-held photos in the photo table', () => {
    expect(BUFFER_OWNER_ID).toBe('buffer')
  })
})
