import { createServerFn } from '@tanstack/react-start'
import type { BufferState } from './grant-rules'

export interface BufferAccountView {
  email: string
  state: BufferState
  source: 'database' | 'environment'
}

export interface BufferAccountOverview {
  encryptionReady: boolean
  active: BufferAccountView | null
  pending: (BufferAccountView & { total: number; remaining: number }) | null
  /** Albums a cancelled or finished switch left on a retiring account. */
  returning: { remaining: number } | null
  retiring: { email: string; retireAfter: number | null }[]
  canEdit: boolean
}

export const getBufferAccountFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BufferAccountOverview> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { listBufferGrants, activeBufferEmail, bufferSwitchTarget } =
      await import('./grant')
    const { getSwitchProgress } = await import('./switch-server')
    const { admin, database } = await adminContext(['admin', 'manager'])

    const rows = await listBufferGrants(database)
    const active = rows.find((r) => r.status === 'active')
    const pending = rows.find((r) => r.status === 'pending')
    const target = await bufferSwitchTarget(database)
    const progress = target ? await getSwitchProgress(database, target) : null
    const envEmail = active ? null : await activeBufferEmail(database)

    return {
      encryptionReady: !!process.env.BUFFER_ENCRYPTION_KEY?.trim(),
      canEdit: admin.role === 'admin',
      active: active
        ? { email: active.email, state: active.state, source: 'database' }
        : envEmail
          ? { email: envEmail, state: 'ok', source: 'environment' }
          : null,
      pending: pending
        ? {
            email: pending.email,
            state: pending.state,
            source: 'database',
            total: progress?.total ?? 0,
            remaining: progress?.remaining ?? 0,
          }
        : null,
      returning:
        target?.from && progress ? { remaining: progress.remaining } : null,
      retiring: rows
        .filter((r) => r.status === 'retiring')
        .map((r) => ({
          email: r.email,
          retireAfter: r.retireAfter?.getTime() ?? null,
        })),
    }
  }
)

export const startBufferConnectFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ url: string }> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { getRequest } = await import('@tanstack/react-start/server')
    const { buildBufferAuthUrl } = await import('./connect-url')
    const { bufferCallbackUrl, BUFFER_OAUTH_PREFIX } =
      await import('./grant-rules')
    const { admin } = await adminContext(['admin'])

    if (!process.env.BUFFER_ENCRYPTION_KEY?.trim()) {
      throw new Error(
        'BUFFER_ENCRYPTION_KEY is not set. Add it as a Worker secret first.'
      )
    }
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')

    const nonce = crypto.randomUUID()
    await env.meriksirat_kv.put(
      `${BUFFER_OAUTH_PREFIX}${nonce}`,
      JSON.stringify({ userId: admin.id }),
      { expirationTtl: 600 }
    )
    const origin = new URL(getRequest().url).origin
    return {
      url: buildBufferAuthUrl({
        clientId,
        redirectUri: bufferCallbackUrl(origin),
        state: nonce,
      }),
    }
  }
)

export const cancelBufferSwitchFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<void> => {
  const { adminContext } = await import('@/lib/admin/server')
  const { cancelPendingGrant } = await import('./grant')
  const { database } = await adminContext(['admin'])
  await cancelPendingGrant(database)
})

export const continueBufferSwitchFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<{ total: number; remaining: number } | null> => {
  const { adminContext } = await import('@/lib/admin/server')
  const { runBufferSwitch } = await import('./switch-server')
  const { createBudget } = await import('@/lib/cron/budget')
  const { database } = await adminContext(['admin'])
  return runBufferSwitch(database, createBudget(45))
})
