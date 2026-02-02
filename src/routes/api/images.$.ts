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
          const { auth } = await import('@/lib/auth/auth')
          const session = await auth.api.getSession({
            headers: request.headers,
          })

          if (!session) {
            return new Response('Unauthorized', { status: 401 })
          }

          // Get R2 bucket from context
          const { env } = await import('cloudflare:workers')
          const bucket = env.meriksirat_r2

          if (!bucket) {
            console.error('R2 bucket not available')
            return new Response('Storage not configured', { status: 500 })
          }

          // Fetch image from R2
          const object = await bucket.get(imagePath)

          if (!object) {
            return new Response('Image not found', { status: 404 })
          }

          // Return image with appropriate headers
          return new Response(object.body, {
            headers: {
              'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
              'Cache-Control': 'private, max-age=3600', // Private cache since authenticated
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
