import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper, user, volume } from '@/db/schema'
import { newId } from '@/lib/albums/ids'
import { resolveSession } from '@/lib/auth/resolve-session'
import { decodeIdTokenPayload } from '@/lib/flamekeeper/rules'
import { takeOAuthState } from '@/lib/oauth-state'
import {
  bufferCallbackUrl,
  hasFullDriveScope,
  normalizeEmail,
  planConnect,
  refuseBufferAccount,
  type ConnectRefusal,
} from '@/lib/buffer/grant-rules'
import {
  ENV_GRANT_ID,
  legacyBufferEmail,
  listBufferGrants,
  replaceBufferGrantToken,
  reviveBufferGrant,
  storeBufferGrant,
  forgetBufferGrantRows,
} from '@/lib/buffer/grant'
import { forgetBufferAccessToken } from '@/lib/buffer/tokens'

const RETURN_PATH = '/admin/settings/storage'

function redirectTo(origin: string, error?: ConnectRefusal) {
  const url = new URL(RETURN_PATH, origin)
  if (error) url.searchParams.set('buffer_error', error)
  else url.searchParams.set('buffer', 'connected')
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Cache-Control': 'no-store' },
  })
}

export const Route = createFileRoute('/api/buffer/callback')({
  server: {
    handlers: {
      async GET({ request }) {
        const requestUrl = new URL(request.url)
        const origin = requestUrl.origin
        const nonce = requestUrl.searchParams.get('state')
        const code = requestUrl.searchParams.get('code')

        const session = await resolveSession(request.headers)
        if (!session?.user) {
          return new Response(null, {
            status: 302,
            headers: { Location: new URL('/login', origin).toString() },
          })
        }
        const database = db(env.meriksirat_d1 as D1Database)
        const me = await database
          .select({ role: user.role })
          .from(user)
          .where(eq(user.id, session.user.id))
          .get()
        if (me?.role !== 'admin') return redirectTo(origin, 'session')

        if (!nonce) return redirectTo(origin, 'state')
        const started = await takeOAuthState<{ userId: string }>(
          database,
          'buffer',
          nonce
        )
        if (!started) return redirectTo(origin, 'state')
        if (started.userId !== session.user.id) {
          return redirectTo(origin, 'session')
        }
        if (requestUrl.searchParams.get('error') || !code) {
          return redirectTo(origin, 'denied')
        }

        const tokenResponse = await fetch(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_CLIENT_ID as string,
              client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
              redirect_uri: bufferCallbackUrl(origin),
              grant_type: 'authorization_code',
            }),
          }
        )
        if (!tokenResponse.ok) return redirectTo(origin, 'token')
        const tokens = (await tokenResponse.json()) as {
          refresh_token?: string
          id_token?: string
          scope?: string
        }
        const identity = tokens.id_token
          ? decodeIdTokenPayload(tokens.id_token)
          : null
        if (!identity?.email || !identity.email_verified) {
          return redirectTo(origin, 'unverified')
        }
        if (!hasFullDriveScope(tokens.scope)) return redirectTo(origin, 'scope')
        if (!tokens.refresh_token) return redirectTo(origin, 'token')

        const email = normalizeEmail(identity.email)
        const [registered, keeper] = await Promise.all([
          database
            .select({ id: user.id })
            .from(user)
            .where(sql`lower(${user.email}) = ${email}`)
            .get(),
          database
            .select({ id: flamekeeper.userId })
            .from(flamekeeper)
            .innerJoin(user, eq(user.id, flamekeeper.userId))
            .where(sql`lower(${user.email}) = ${email}`)
            .get(),
        ])
        const refusal = refuseBufferAccount({
          email,
          masterEmail: process.env.GOOGLE_MASTER_EMAIL,
          isRegisteredUser: !!registered,
          isFlamekeeper: !!keeper,
        })
        if (refusal) return redirectTo(origin, refusal)

        const rows = await listBufferGrants(database)
        const active = rows.find((r) => r.status === 'active') ?? null
        const pending = rows.find((r) => r.status === 'pending') ?? null
        const plan = planConnect({
          email,
          active,
          legacyEmail: legacyBufferEmail(),
        })

        if (plan.kind === 'replace-active' && active) {
          await replaceBufferGrantToken(
            database,
            active.id,
            tokens.refresh_token,
            tokens.scope ?? ''
          )
          forgetBufferAccessToken(active.id)
        } else if (plan.kind === 'adopt-legacy') {
          const id = newId(10)
          await storeBufferGrant(database, {
            id,
            email,
            refreshToken: tokens.refresh_token,
            scopes: tokens.scope ?? '',
            status: 'active',
          })
          await database
            .update(volume)
            .set({ bufferGrantId: id })
            .where(isNull(volume.bufferGrantId))
          forgetBufferGrantRows()
        } else if (pending && normalizeEmail(pending.email) === email) {
          await replaceBufferGrantToken(
            database,
            pending.id,
            tokens.refresh_token,
            tokens.scope ?? ''
          )
          forgetBufferAccessToken(pending.id)
        } else if (pending) {
          return redirectTo(origin, 'busy')
        } else {
          // Switching back to a previous account keeps its grant, so the
          // switch finds the originals it still holds instead of copying.
          const previous = rows.find(
            (r) => r.status === 'retiring' && normalizeEmail(r.email) === email
          )
          if (previous) {
            await reviveBufferGrant(
              database,
              previous.id,
              tokens.refresh_token,
              tokens.scope ?? ''
            )
            forgetBufferAccessToken(previous.id)
          } else {
            const id = newId(10)
            await storeBufferGrant(database, {
              id,
              email,
              refreshToken: tokens.refresh_token,
              scopes: tokens.scope ?? '',
              status: 'pending',
            })
            if (email === normalizeEmail(legacyBufferEmail())) {
              await database
                .update(volume)
                .set({ bufferGrantId: id })
                .where(eq(volume.bufferGrantId, ENV_GRANT_ID))
            }
          }
        }
        return redirectTo(origin)
      },
    },
  },
})
