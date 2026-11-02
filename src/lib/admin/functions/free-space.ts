import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export interface FreeSpaceSuggestion {
  id: string
  title: string
  expiresAt: Date | null
  photoBytes: number
  photoCount: number
  favoriteCount: number
}

export const getDeletionSuggestionsFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<FreeSpaceSuggestion[]> => {
  const { adminContext } = await import('../server')
  const { listDeletionSuggestions } = await import('@/lib/albums/early-expiry')

  const { database } = await adminContext(['admin'])
  return listDeletionSuggestions(database)
})

export const expireAlbumNowFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('../server')
    const { expireAlbumEarly } = await import('@/lib/albums/early-expiry')

    const { database } = await adminContext(['admin'])
    return expireAlbumEarly(database, data.albumId)
  })
