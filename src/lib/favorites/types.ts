import { z } from 'zod'
import type { AlbumPhoto } from '@/lib/albums/types'

export const SetFavoriteSchema = z.object({
  albumId: z.string(),
  driveFileId: z.string().min(1).max(200),
  favorite: z.boolean(),
})

export const SetAlbumHeartSchema = z.object({
  albumId: z.string(),
  hearted: z.boolean(),
})

export interface FavoritePhoto extends AlbumPhoto {
  albumId: string
  albumTitle: string
  favoritedAt: string
}
