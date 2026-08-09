import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/drive-image/$')({
  server: {
    handlers: {
      async GET({ request, params }) {
        const splat = params['_splat'] ?? ''
        const [albumId, fileId, ...rest] = splat.split('/')

        if (!albumId || !fileId || rest.length > 0) {
          return new Response('Not found', { status: 404 })
        }

        const { env } = await import('cloudflare:workers')
        const { db } = await import('@/db')
        const { album } = await import('@/db/schema')
        const { eq } = await import('drizzle-orm')
        const { resolveAlbumAccess } = await import('@/lib/albums/server')

        const database = db(env.meriksirat_d1 as D1Database)
        const row = await database
          .select()
          .from(album)
          .where(eq(album.id, albumId))
          .get()

        if (!row) return new Response('Not found', { status: 404 })

        // Only authenticated users with album access may stream private photos.
        const { access } = await resolveAlbumAccess(request.headers, row)
        if (access === 'none') {
          return new Response('Unauthorized', { status: 401 })
        }

        const url = new URL(request.url)
        const isDownload = url.searchParams.get('download') === '1'

        // Edge-cache repeat views to protect the master account's Drive API quota.
        const cache = (caches as CacheStorage & { default: Cache }).default
        const cacheKey = new Request(url, { method: 'GET' })
        const cached = !isDownload ? await cache.match(cacheKey) : undefined
        if (cached) return cached

        const { getGoogleAccessToken } =
          await import('@/lib/google/google-calendar-auth')
        const { getDriveFileMetadata, streamDriveFile } =
          await import('@/lib/google/google-drive')

        const accessToken = await getGoogleAccessToken()
        const [meta, drive] = await Promise.all([
          getDriveFileMetadata(accessToken, fileId),
          streamDriveFile(accessToken, fileId),
        ])

        const response = new Response(drive.body, {
          headers: {
            'Content-Type': meta.mimeType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600',
            ...(isDownload
              ? {
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(
                    meta.name || fileId
                  )}"`,
                }
              : {}),
          },
        })

        try {
          if (!isDownload) {
            await cache.put(cacheKey, response.clone())
          }
        } catch (error) {
          console.warn('Failed to cache drive image:', error)
        }

        return response
      },
    },
  },
})
