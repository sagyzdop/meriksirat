import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper, flamekeeperGrant, user } from '@/db/schema'
import { isMasterEmail } from '@/lib/flamekeeper/master'
import { forgetFlamekeeperAccessToken } from '@/lib/flamekeeper/tokens'
import { resolveSession } from '@/lib/auth/resolve-session'
import {
  decodeIdTokenPayload,
  driveAccountMatches,
  flamekeeperCallbackUrl,
  hasDriveFileScope,
  type ConnectErrorCode,
} from '@/lib/flamekeeper/rules'

interface PendingConnect {
  userId: string
  pledgedBytes: number
  graduationDate: string | null
  termsAcceptedAt: number
}

function redirectTo(origin: string, path: string, error?: ConnectErrorCode) {
  const url = new URL(path, origin)
  if (error) url.searchParams.set('fk_error', error)
  else url.searchParams.set('flamekeeper', 'connected')
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Cache-Control': 'no-store' },
  })
}

export const Route = createFileRoute('/api/flamekeeper/callback')({
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
        const rows = await database
          .select({ isMember: user.isMember })
          .from(user)
          .where(eq(user.id, session.user.id))
          .get()
        const existingFk = await database
          .select({ userId: flamekeeper.userId })
          .from(flamekeeper)
          .where(eq(flamekeeper.userId, session.user.id))
          .get()
        const failPath =
          rows?.isMember || existingFk ? '/profile' : '/onboarding'

        if (!nonce) return redirectTo(origin, failPath, 'state')
        const key = `flamekeeper-oauth:${nonce}`
        const raw = await env.meriksirat_kv.get(key)
        if (raw) await env.meriksirat_kv.delete(key)
        if (!raw) return redirectTo(origin, failPath, 'state')

        const pending = JSON.parse(raw) as PendingConnect
        if (pending.userId !== session.user.id) {
          return redirectTo(origin, failPath, 'session')
        }

        if (requestUrl.searchParams.get('error') || !code) {
          return redirectTo(origin, failPath, 'denied')
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
              redirect_uri: flamekeeperCallbackUrl(origin),
              grant_type: 'authorization_code',
            }),
          }
        )
        if (!tokenResponse.ok) return redirectTo(origin, failPath, 'token')

        const tokens = (await tokenResponse.json()) as {
          refresh_token?: string
          id_token?: string
          scope?: string
        }

        const identity = tokens.id_token
          ? decodeIdTokenPayload(tokens.id_token)
          : null
        const masterEmail = process.env.GOOGLE_MASTER_EMAIL
        if (
          isMasterEmail(session.user.email, masterEmail) ||
          isMasterEmail(identity?.email, masterEmail)
        ) {
          return redirectTo(origin, failPath, 'master')
        }
        if (
          !identity?.email_verified ||
          !driveAccountMatches(identity.email, session.user.email)
        ) {
          return redirectTo(origin, failPath, 'account')
        }
        if (!hasDriveFileScope(tokens.scope)) {
          return redirectTo(origin, failPath, 'scope')
        }
        if (!tokens.refresh_token) return redirectTo(origin, failPath, 'token')

        const now = new Date()
        await database.batch([
          database
            .update(user)
            .set({
              ...(pending.graduationDate
                ? { graduationDate: pending.graduationDate }
                : {}),
              updatedAt: now,
            })
            .where(eq(user.id, pending.userId)),
          database
            .insert(flamekeeper)
            .values({
              userId: pending.userId,
              pledgedBytes: pending.pledgedBytes,
              graduationConfirmedAt: now,
              termsAcceptedAt: new Date(pending.termsAcceptedAt),
            })
            .onConflictDoUpdate({
              target: flamekeeper.userId,
              set: {
                pledgedBytes: pending.pledgedBytes,
                termsAcceptedAt: new Date(pending.termsAcceptedAt),
                state: 'active',
                drainingDeadline: null,
                lostSince: null,
                lostNotifiedAt: null,
                lostFinalizedAt: null,
                healthCheckedAt: now,
                updatedAt: now,
              },
            }),
          database
            .insert(flamekeeperGrant)
            .values({
              userId: pending.userId,
              refreshToken: tokens.refresh_token,
              scopes: tokens.scope ?? '',
              lastRefreshAt: now,
            })
            .onConflictDoUpdate({
              target: flamekeeperGrant.userId,
              set: {
                refreshToken: tokens.refresh_token,
                scopes: tokens.scope ?? '',
                lastRefreshAt: now,
                updatedAt: now,
              },
            }),
        ])
        forgetFlamekeeperAccessToken(pending.userId)

        return redirectTo(origin, '/profile')
      },
    },
  },
})
