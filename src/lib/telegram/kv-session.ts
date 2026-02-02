/**
 * Telegram Session Management
 * 
 * Handles KV storage for telegram bot sessions during equipment return flow.
 */

import type { SessionData } from './types'

export async function getSession(kv: KVNamespace, chatId: string): Promise<SessionData | null> {
  const data = await kv.get(`session:${chatId}`, 'json')
  return data as SessionData | null
}

export async function setSession(kv: KVNamespace, chatId: string, data: SessionData) {
  await kv.put(`session:${chatId}`, JSON.stringify({
    ...data,
    createdAt: Date.now()
  }), { expirationTtl: 3600 }) // 1 hour TTL
}

export async function deleteSession(kv: KVNamespace, chatId: string) {
  await kv.delete(`session:${chatId}`)
}