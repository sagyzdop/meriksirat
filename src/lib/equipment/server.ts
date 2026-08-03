import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getUserClearanceLevel(userId: string): Promise<number> {
  const { env } = await import('cloudflare:workers')
  const database = db(env.meriksirat_d1 as D1Database)
  const userData = await database
    .select({ clearanceLevel: user.clearanceLevel })
    .from(user)
    .where(eq(user.id, userId))
    .get()
  
  return userData?.clearanceLevel || 1
}
