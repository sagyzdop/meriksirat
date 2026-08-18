/**
 * Rate limiter backed by Cloudflare's native Rate Limiting binding.
 *
 * Each limiter is declared in wrangler.jsonc under "ratelimits" and maps 1:1
 * to a binding name. The binding counters live on the same edge machine as
 * the Worker — no KV reads/writes involved.
 *
 * https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */

const PERIOD_SECONDS = 60

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
  limiterName: string,
  identity?: string
): Promise<RateLimitResult> {
  const subject = identity ?? clientIp(headers)
  if (!subject) return { allowed: true }

  try {
    const { env } = await import('cloudflare:workers')
    const limiter = (env as Record<string, unknown>)[limiterName] as
      | { limit(opts: { key: string }): Promise<{ success: boolean }> }
      | undefined
    if (!limiter) return { allowed: true }

    const { success } = await limiter.limit({ key: subject })
    if (success) return { allowed: true }

    return { allowed: false, retryAfterSeconds: PERIOD_SECONDS }
  } catch (error) {
    console.warn('Rate limiter failed open:', error)
    return { allowed: true }
  }
}
