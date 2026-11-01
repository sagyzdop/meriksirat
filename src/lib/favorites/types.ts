import { z } from 'zod'
import type { AlbumPhoto } from '@/lib/albums/types'

export const SetFavoriteSchema = z.object({
  albumId: z.string(),
  photoId: z.string().max(100).nullable().optional(),
  driveFileId: z.string().min(1).max(200),
  favorite: z.boolean(),
})

export const GetAlbumFavoritesSchema = z.object({
  albumId: z.string(),
})

export interface FavoritePhoto extends AlbumPhoto {
  albumId: string
  albumTitle: string
  favoritedAt: string
}
