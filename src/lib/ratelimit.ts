/**
 * Minimal fixed-window rate limiter backed by KV.
 *
 * This is a cheap defense-in-depth guard for unauthenticated endpoints. It is
 * approximate — KV reads/writes are not atomic, so the count can be off under
 * concurrency — and it fails open if the client IP cannot be attributed or KV
 * is unavailable. It must never be the only access control.
 */

const DEFAULT_WINDOW_MS = 60_000

export interface RateLimitOptions {
  /** Namespace prefix for the counters, e.g. `public-albums`. */
  name: string
  /** Requests allowed per window. */
  limit: number
  /** Window length in milliseconds. Defaults to 60s. */
  windowMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
}

export function clientIp(headers: Headers): string | null {
  const cf = headers.get('CF-Connecting-IP')
  if (cf) return cf
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return null
}

export async function rateLimit(
  headers: Headers,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ip = clientIp(headers)
  if (!ip) return { allowed: true }

  try {
    const { env } = await import('cloudflare:workers')
    const kv = env.meriksirat_kv as KVNamespace | undefined
    if (!kv) return { allowed: true }

    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
    const bucket = Math.floor(Date.now() / windowMs)
    const key = `rl:${options.name}:${ip}:${bucket}`

    const current = Number((await kv.get(key)) ?? '0')
    if (current >= options.limit) {
      const expiresAt = (bucket + 1) * windowMs
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((expiresAt - Date.now()) / 1000)
        ),
      }
    }

    const ttlSeconds = Math.ceil(windowMs / 1000) + 5
    await kv.put(key, String(current + 1), { expirationTtl: ttlSeconds })
    return { allowed: true }
  } catch (error) {
    console.warn('Rate limiter failed open:', error)
    return { allowed: true }
  }
}
