/**
 * Custom Cloudflare Workers entry point
 * Handles both HTTP requests and scheduled cron triggers
 *
 * Based on TanStack Start documentation:
 * https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack/
 */

import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { type Budget } from './src/lib/cron/budget'
import { planScheduledRun, type CronStepName } from './src/lib/cron/schedule'
import { guestHtmlTtlSeconds } from './src/lib/cache/guest-html'

interface Env {
  meriksirat_d1: D1Database
  meriksirat_r2: R2Bucket
  meriksirat_kv: KVNamespace
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CLUB_CHANNEL_ID?: string
  BETTER_AUTH_URL?: string
  CF_VERSION_METADATA?: { id: string }
}

const serverEntry = createServerEntry({
  async fetch(request): Promise<Response> {
    const res = await serveGuestHtmlCache(request, () => handler.fetch(request))
    return res as Response
  },
})

/**
 * Edge cache for guest document loads of the public album pages and /about.
 *
 * Logged-out visitors (and scrapers fetching link previews) hit /albums and
 * /albums/:id constantly when links are shared. Each uncached document load
 * costs the Worker several milliseconds of CPU (auth probe, loaders, shell
 * SSR, hydration payload). Guest HTML is fully viewer-independent, so we cache
 * the rendered response at the edge and replay it without executing any app
 * code on subsequent hits. Authenticated requests are never intercepted
 * (Cookie header present), and editor-token URLs (?edit=...) are never cached
 * because they unlock per-link state.
 */
async function serveGuestHtmlCache(
  request: Request,
  run: () => Response | Promise<Response>
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const ttl = guestHtmlTtlSeconds(url.pathname)
    if (
      request.method !== 'GET' ||
      ttl === null ||
      request.headers.get('cookie') ||
      !(request.headers.get('accept') || '').includes('text/html') ||
      url.searchParams.has('edit')
    ) {
      return run()
    }

    // The Cache API is used instead of KV because it has no per-operation
    // quotas (KV free tier allows only 1,000 writes/day, which a hot album
    // link would exhaust at one write per TTL window). It is per-colo: each
    // data center pays the first render once per TTL window.
    const cache = (caches as unknown as { default: Cache }).default
    const hit = await cache.match(request)
    if (hit) {
      const headers = new Headers(hit.headers)
      headers.set('x-guest-html-cache', 'hit')
      return new Response(await hit.text(), { status: 200, headers })
    }

    const response = await run()

    // Only cache successful HTML documents. Buffer the body so it can be both
    // returned and stored; only this first request pays for that.
    const contentType = response.headers.get('content-type') || ''
    if (response.status === 200 && contentType.includes('text/html')) {
      const html = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        if (
          !['content-encoding', 'transfer-encoding', 'content-length'].includes(
            key
          )
        ) {
          headers[key] = value
        }
      })
      headers['x-guest-html-cache'] = 'miss'
      const storedHeaders = new Headers(headers)
      // The TTL is carried on the stored response only; visitors get the
      // header stripped so browsers revalidate normally.
      storedHeaders.set('cache-control', `public, max-age=${ttl}`)
      try {
        await cache.put(
          request,
          new Response(html, {
            status: 200,
            headers: storedHeaders,
          })
        )
      } catch (error) {
        console.warn('Failed to store guest HTML in edge cache:', error)
      }
      return new Response(html, { status: 200, headers })
    }

    return response
  } catch (error) {
    console.warn('Guest HTML cache layer failed:', error)
    return new Response('Internal server error', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
  }
}

export default {
  ...serverEntry,

  // Handle scheduled cron triggers
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScheduled(controller.cron, env))
  },
}

type Step = (env: Env, budget: Budget) => Promise<unknown>

const STEPS: Record<CronStepName, () => Promise<Step>> = {
  cancelUnstartedBookings: () =>
    import('./src/lib/booking/cron').then((m) => m.cancelUnstartedBookings),
  updateOverdueBookings: () =>
    import('./src/lib/booking/cron').then((m) => m.updateOverdueBookings),
  sendBookingReminders: () =>
    import('./src/lib/booking/cron').then((m) => m.sendBookingReminders),
  backfillAlbumPhotos: () =>
    import('./src/lib/albums/photo-index').then((m) => m.runPhotoBackfill),
  checkFlamekeeperHealth: () =>
    import('./src/lib/pool/health-server').then((m) => m.runFlamekeeperHealth),
  maintainPool: () =>
    import('./src/lib/pool/server').then((m) => m.runPoolMaintenance),
  drainFlamekeepers: () =>
    import('./src/lib/pool/drain-cron').then((m) => m.runDrainMaintenance),
  finishBans: () =>
    import('./src/lib/pool/ban-server').then((m) => m.runBanMaintenance),
  expireAlbums: () =>
    import('./src/lib/albums/expiry').then((m) => m.runAlbumExpiry),
  checkBufferUsage: () =>
    import('./src/lib/buffer/usage-server').then((m) => m.runBufferUsageCheck),
  graduateFlamekeepers: () =>
    import('./src/lib/pool/graduation-server').then(
      (m) => m.runGraduationMaintenance
    ),
}

async function runScheduled(cron: string, env: Env): Promise<void> {
  const plan = planScheduledRun(cron)
  if (!plan) {
    console.warn(`[cron] no steps for schedule "${cron}"`)
    return
  }
  const { budget } = plan

  for (const name of plan.steps) {
    try {
      await (
        await STEPS[name]()
      )(env, budget)
    } catch (error) {
      console.error(`Error in ${name}:`, error)
    }
  }

  if (plan.configuresBot) {
    try {
      const { configureTelegramBotOncePerDeploy } =
        await import('./src/lib/telegram/configure')
      await configureTelegramBotOncePerDeploy(env, budget)
    } catch (error) {
      console.error('Error in configureTelegramBot:', error)
    }
  }

  console.log(
    `[cron] ${cron} outside requests ${budget.spent()}/${budget.total}`
  )
}
