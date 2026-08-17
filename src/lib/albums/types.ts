import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'

/**
 * Minimum user clearance level required to create a new album. Users below
 * this level see the Albums section disabled in the sidebar.
 */
export const ALBUM_CREATE_MIN_CLEARANCE = 3

export const AlbumOwnershipFilterSchema = z.enum(['owner', 'co-author'])
export type AlbumOwnershipFilter = z.infer<typeof AlbumOwnershipFilterSchema>

export const AlbumVisibilityFilterSchema = z.enum(['public', 'private'])
export type AlbumVisibilityFilter = z.infer<typeof AlbumVisibilityFilterSchema>

/**
 * User-facing list filters (mirrored into the URL search params). Ownership
 * and visibility are multi-select arrays; an empty array means "no filter".
 */
export const AlbumListFiltersSchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  ownership: stringArrayParam(AlbumOwnershipFilterSchema).default([]),
  visibility: stringArrayParam(AlbumVisibilityFilterSchema).default([]),
})
export type AlbumListFilters = z.infer<typeof AlbumListFiltersSchema>

/**
 * Search-only filters for the public albums page, where ownership and
 * visibility do not apply.
 */
export const AlbumSearchSchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
})
export type AlbumSearch = z.infer<typeof AlbumSearchSchema>

/**
 * Server query: filters plus cursor pagination.
 */
export const AlbumListQuerySchema = AlbumListFiltersSchema.extend({
  limit: z.number().int().min(1).max(100).optional().default(24),
  cursor: z.string().max(500).nullable().optional().default(null),
})
export type AlbumListQuery = z.infer<typeof AlbumListQuerySchema>

export interface AlbumListPage {
  albums: AlbumSummary[]
  nextCursor: string | null
}

export const CreateAlbumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().default(''),
  event: z.string().min(1, 'Event is required').max(200),
  eventDate: z.string().min(1, 'Event date is required'),
})

export const GetAlbumSchema = z.object({
  albumId: z.string(),
})

export const UpdateAlbumSchema = z.object({
  albumId: z.string(),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(1000).optional(),
  event: z.string().min(1, 'Event is required').max(200).optional(),
  eventDate: z.string().optional(),
})

export const DeleteAlbumSchema = z.object({
  albumId: z.string(),
})

export const ToggleAlbumShareSchema = z.object({
  albumId: z.string(),
  shared: z.boolean(),
})

export const ClaimEditAccessSchema = z.object({
  albumId: z.string(),
  token: z.string(),
})

export const RotateEditTokenSchema = z.object({
  albumId: z.string(),
})

export const DeletePhotoSchema = z.object({
  albumId: z.string(),
  fileId: z.string(),
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
})

export const RefreshAlbumSchema = z.object({
  albumId: z.string(),
})

export const RecreateAlbumSchema = z.object({
  albumId: z.string(),
})

export const RestoreAlbumSchema = z.object({
  albumId: z.string(),
})

export type AlbumAccessLevel = 'none' | 'owner' | 'editor' | 'manager'

/**
 * Health of the Google Drive folder behind an album.
 * - `ok`: folder exists and is usable.
 * - `trashed`: folder is in the Drive bin — uploads are blocked until restored.
 * - `missing`: folder was permanently deleted — photos are unrecoverable.
 */
export type AlbumFolderState = 'ok' | 'trashed' | 'missing'

export interface AlbumAuthor {
  id: string
  name: string
  /**
   * Telegram @username, used when composing a share message ("by @user").
   */
  telegramUsername: string | null
}

export interface AlbumPhoto {
  id: string
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
  isShared: boolean
  createdAt: string
  updatedAt: string
  ownership: 'owner' | 'co-author'
  coAuthorCount: number
  authors: AlbumAuthor[]
}

export interface AlbumDetail extends Omit<AlbumSummary, 'coverUrl'> {
  coverUrl: string | null
  photos: AlbumPhoto[]
  access: AlbumAccessLevel
  editShareToken: string | null
  /**
   * Health of the album's Google Drive folder. `missing` means the folder was
   * permanently deleted in Drive (photos are unrecoverable), `trashed` means
   * it is sitting in the bin and can be restored.
   */
  folderState: AlbumFolderState
}

export interface UploadSession {
  uploadUrl: string
}
