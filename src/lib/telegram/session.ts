/**
 * Telegram Session Management
 *
 * Bot sessions for the booking flows, kept in the D1 `app_state` table.
 * Sessions expire after 1 hour, so no explicit delete is needed.
 */

import { readState, writeState } from '@/lib/app-state'
import type { SessionData } from './types'

const SESSION_TTL_SECONDS = 3600

const sessionKey = (chatId: string) => `session:${chatId}`

export async function getSession(chatId: string): Promise<SessionData | null> {
  const raw = await readState(sessionKey(chatId))
  return raw ? (JSON.parse(raw) as SessionData) : null
}

export async function setSession(chatId: string, data: SessionData) {
  await writeState(
    sessionKey(chatId),
    JSON.stringify({
      ...data,
      createdAt: Date.now(),
    }),
    SESSION_TTL_SECONDS
  )
}
