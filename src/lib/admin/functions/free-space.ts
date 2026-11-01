import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
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
  const { checkAdminPermission } = await import('../server')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  const { listDeletionSuggestions } = await import('@/lib/albums/early-expiry')

  await checkAdminPermission(getRequestHeaders(), ['admin'])
  return listDeletionSuggestions(db(env.meriksirat_d1 as D1Database))
})

export const expireAlbumNowFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { expireAlbumEarly } = await import('@/lib/albums/early-expiry')

    await checkAdminPermission(getRequestHeaders(), ['admin'])
    return expireAlbumEarly(db(env.meriksirat_d1 as D1Database), data.albumId)
  })
