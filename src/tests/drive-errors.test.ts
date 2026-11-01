import { describe, expect, it } from 'vitest'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  DriveQuotaExceededError,
  driveErrorFor,
} from '@/lib/google/google-drive'

describe('driveErrorFor', () => {
  it('maps 404 to not found', () => {
    expect(driveErrorFor(404, '')).toBeInstanceOf(DriveNotFoundError)
  })

  it('maps storageQuotaExceeded to quota exceeded', () => {
    const body = '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}'
    expect(driveErrorFor(403, body)).toBeInstanceOf(DriveQuotaExceededError)
  })

  it('maps appNotAuthorizedToChild to its own error', () => {
    const body = '{"error":{"errors":[{"reason":"appNotAuthorizedToChild"}]}}'
    expect(driveErrorFor(403, body)).toBeInstanceOf(DriveAppNotAuthorizedError)
  })

  it('keeps other failures generic', () => {
    const error = driveErrorFor(500, 'boom')
    expect(error).not.toBeInstanceOf(DriveAppNotAuthorizedError)
    expect(error.message).toContain('500')
  })
})
