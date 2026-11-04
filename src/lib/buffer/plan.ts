import { BUFFER_FULL_MESSAGE, BUFFER_UNAVAILABLE_MESSAGE } from './messages'
import {
  DriveAuthError,
  DriveQuotaExceededError,
} from '@/lib/google/google-drive'

export const BUFFER_OWNER_ID = 'buffer'
export const DEFAULT_BUFFER_EMAIL = 'nuimage.storage@gmail.com'

export { BUFFER_FULL_MESSAGE, BUFFER_UNAVAILABLE_MESSAGE }

const REQUIRED_FOR_UPLOAD = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_BUFFER_REFRESH_TOKEN',
] as const

export type BufferUploadPlan =
  | { kind: 'buffer'; email: string }
  | { kind: 'unavailable'; message: string; missing: string[] }

export function planBufferUpload(
  env: Record<string, string | undefined>
): BufferUploadPlan {
  const missing = REQUIRED_FOR_UPLOAD.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    return {
      kind: 'unavailable',
      message: BUFFER_UNAVAILABLE_MESSAGE,
      missing: [...missing],
    }
  }
  return {
    kind: 'buffer',
    email: env.GOOGLE_BUFFER_EMAIL?.trim() || DEFAULT_BUFFER_EMAIL,
  }
}

export interface VolumeFolderState {
  driveFolderId: string | null
  permissionId: string
}

export function planVolumeSetup(existing: VolumeFolderState | null): {
  create: boolean
  share: boolean
} {
  if (!existing?.driveFolderId) return { create: true, share: true }
  return { create: false, share: !existing.permissionId }
}

export function decideMissingVolumeFolder(input: {
  hasPhotos: boolean
  retried: boolean
}): 'recreate' | 'fail' {
  return input.hasPhotos || input.retried ? 'fail' : 'recreate'
}

export function bufferUploadMessage(error: unknown): string | null {
  if (error instanceof DriveQuotaExceededError) return BUFFER_FULL_MESSAGE
  if (error instanceof DriveAuthError) return BUFFER_UNAVAILABLE_MESSAGE
  if (
    error instanceof Error &&
    error.message.startsWith('Failed to refresh buffer access token')
  ) {
    return BUFFER_UNAVAILABLE_MESSAGE
  }
  return null
}
