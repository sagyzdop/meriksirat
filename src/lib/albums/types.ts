import { z } from 'zod'

export const AlbumFilterSchema = z.enum([
  'all',
  'owned',
  'shared-by-me',
  'shared-with-me',
]).default('all')
export type AlbumFilter = z.infer<typeof AlbumFilterSchema>

export const CreateAlbumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().default(''),
})

export const GetAlbumSchema = z.object({
  albumId: z.string(),
})

export const UpdateAlbumSchema = z.object({
  albumId: z.string(),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(1000).optional(),
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
  fileName: z.string(),
  mimeType: z.string(),
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
}

export interface AlbumPhoto {
  id: string
  name: string
  mimeType: string
  size: number | null
  capturedAt: string
  url: string
  thumbnailUrl: string
}

export interface AlbumSummary {
  id: string
  ownerUserId: string
  title: string
  description: string
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
