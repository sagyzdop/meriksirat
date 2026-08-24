import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/images/$')({
  server: {
    handlers: {
      async GET({ request, params }) {
        try {
          const imagePath = params['_splat']

          if (!imagePath) {
            return new Response('Image path is required', { status: 400 })
          }

          // Check authentication
          const { resolveSession } = await import('@/lib/auth/resolve-session')
          const session = await resolveSession(request.headers)

          if (!session) {
            return new Response('Unauthorized', { status: 401 })
          }

          // Per-user rate limit: image serving reads R2 on every miss, and an
          // authenticated user should not be able to flood it.
          const { rateLimit } = await import('@/lib/ratelimit')
          const rl = await rateLimit(
            request.headers,
            'rl_images',
            session.user.id
          )
          if (!rl.allowed) {
            return new Response('Too Many Requests', { status: 429 })
          }

          // Get R2 bucket from context
          const { env } = await import('cloudflare:workers')
          const bucket = env.meriksirat_r2

          if (!bucket) {
            console.error('R2 bucket not available')
            return new Response('Storage not configured', { status: 500 })
          }

          // Conditional read: when the client revalidates with If-None-Match,
          // R2 evaluates it server-side and skips the body transfer entirely,
          // letting us answer 304 without streaming the object.
          const object = await bucket.get(imagePath, {
            onlyIf: request.headers,
          })

          if (!object) {
            return new Response('Image not found', { status: 404 })
          }

          const hasBody = 'body' in object && object.body != null

          // Return image with appropriate headers
          return new Response(hasBody ? object.body : null, {
            status: hasBody ? 200 : 304,
            headers: {
              'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
              // Private cache since authenticated; one day of reuse cuts
              // repeat R2 reads and Worker CPU dramatically.
              'Cache-Control': 'private, max-age=86400',
              ETag: object.httpEtag || '',
            },
          })
        } catch (error) {
          console.error('Error serving image:', error)
          return new Response('Internal server error', { status: 500 })
        }
      },
    },
  },
})
