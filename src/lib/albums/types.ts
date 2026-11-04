import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'
import type { TombstoneReason } from '@/lib/pool/expiry'

export const ALBUM_CREATE_MIN_CLEARANCE = 3

export const AlbumOwnershipFilterSchema = z.enum(['owner', 'co-author'])
export type AlbumOwnershipFilter = z.infer<typeof AlbumOwnershipFilterSchema>

export const AlbumListFiltersSchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  ownership: stringArrayParam(AlbumOwnershipFilterSchema).default([]),
})
export type AlbumListFilters = z.infer<typeof AlbumListFiltersSchema>

export const AlbumSearchSchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
})
export type AlbumSearch = z.infer<typeof AlbumSearchSchema>

export const AlbumListQuerySchema = AlbumListFiltersSchema.extend({
  limit: z.number().int().min(1).max(100).optional().default(24),
  cursor: z.string().max(500).nullable().optional().default(null),
})
export type AlbumListQuery = z.infer<typeof AlbumListQuerySchema>

export interface AlbumListPage {
  albums: AlbumSummary[]
  nextCursor: string | null
}

export const AlbumIdSchema = z.object({
  albumId: z.string(),
})

export const CreateAlbumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().default(''),
  event: z.string().min(1, 'Event is required').max(200),
  eventDate: z.string().min(1, 'Event date is required'),
})

export const UpdateAlbumSchema = z.object({
  albumId: z.string(),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(1000).optional(),
  event: z.string().min(1, 'Event is required').max(200).optional(),
  eventDate: z.string().optional(),
})

export const SetAlbumPinnedSchema = z.object({
  albumId: z.string(),
  pinned: z.boolean(),
})

export const ClaimEditAccessSchema = z.object({
  albumId: z.string(),
  token: z.string(),
})

export const DeletePhotoSchema = z.object({
  albumId: z.string(),
  fileId: z.string(),
})

export const ConfirmPhotoUploadSchema = z.object({
  albumId: z.string(),
  fileId: z.string().min(1).max(200),
  reservationId: z.string().min(1).max(64),
})

export const ReleaseUploadSchema = z.object({
  albumId: z.string(),
  reservationId: z.string().min(1).max(64),
  quotaExceeded: z.boolean(),
})

export const SetCoverPhotoSchema = z.object({
  albumId: z.string(),
  fileId: z.string(),
})

export const RemoveMemberSchema = z.object({
  albumId: z.string(),
  userId: z.string(),
})

export const CreateUploadSessionSchema = z.object({
  albumId: z.string(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024 * 1024),
})

export type AlbumAccessLevel = 'none' | 'owner' | 'editor' | 'manager'

/**
 * Health of the Google Drive folder behind an album.
 * - `ok`: folder exists and is usable.
 * - `trashed`: folder is in the Drive bin — uploads are blocked and a warning links to it.
 * - `missing`: folder was permanently deleted — a warning links to it and an admin can delete the album.
 */
export type AlbumFolderState =
  import('@/lib/google/google-drive').DriveFolderState

export interface AlbumAuthor {
  id: string
  name: string
  /**
   * Telegram @username, used when composing a share message ("by @user").
   */
  telegramUsername: string | null
}

export interface AlbumPhotoExif {
  cameraMake?: string
  cameraModel?: string
  exposureTime?: string
  aperture?: number
  focalLength?: number
  isoSpeed?: number
  width?: number
  height?: number
  whiteBalance?: string
}

export interface AlbumPhoto {
  id: string
  photoId?: string | null
  name: string
  mimeType: string
  size: number | null
  capturedAt: string
  /**
   * Drive creation time (ISO). Used to pick the default cover: the first
   * uploaded photo in the folder.
   */
  createdAt?: string
  url: string
  thumbnailUrl: string
  exif?: AlbumPhotoExif
}

export interface AlbumSummary {
  id: string
  ownerUserId: string
  title: string
  description: string
  event: string
  eventDate: string | null
  driveFolderId: string
  coverFileId: string | null
  coverUrl: string | null
  createdAt: string
  updatedAt: string
  ownership: 'owner' | 'co-author'
  coAuthorCount: number
  authors: AlbumAuthor[]
}

export interface AlbumDetail extends AlbumSummary {
  photos: AlbumPhoto[]
  access: AlbumAccessLevel
  editShareToken: string | null
  /**
   * Health of the album's Google Drive folder. `missing` means the folder was
   * permanently deleted in Drive, `trashed` means it is sitting in the bin.
   */
  folderState: AlbumFolderState
  expiresAt: string | null
  pinned: boolean
  tombstone: { reason: TombstoneReason; deletedAt: string } | null
}

export interface UploadSession {
  uploadUrl: string
  reservationId: string
}
