import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { account, session, user } from '@/db/schema'
import {
  STALE_SIGNUP_DAYS,
  STALE_SIGNUP_MAX_DELETES,
  selectStaleSignups,
} from './stale-signups'

const DAY_MS = 24 * 60 * 60 * 1000

const OWNS_ANYTHING = sql<number>`(
  EXISTS (SELECT 1 FROM booking WHERE booking.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM album WHERE album.owner_user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM album_member WHERE album_member.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM favorite WHERE favorite.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM flamekeeper WHERE flamekeeper.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM flamekeeper_grant WHERE flamekeeper_grant.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM volume WHERE volume.flamekeeper_user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM photo WHERE photo.flamekeeper_user_id = ${user.id})
)`

export async function runStaleSignupCleanup(env: {
  meriksirat_d1: D1Database
}): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()
  const cutoff = new Date(now.getTime() - STALE_SIGNUP_DAYS * DAY_MS)

  const rows = await database
    .select({
      id: user.id,
      isMember: user.isMember,
      createdAt: user.createdAt,
      ownsAnything: OWNS_ANYTHING,
    })
    .from(user)
    .where(and(eq(user.isMember, false), lte(user.createdAt, cutoff)))
    .orderBy(user.createdAt)
    .limit(STALE_SIGNUP_MAX_DELETES * 5)
    .all()

  const ids = selectStaleSignups(
    rows.map((r) => ({ ...r, ownsAnything: !!r.ownsAnything })),
    now
  )
  if (ids.length === 0) return

  await database.delete(session).where(inArray(session.userId, ids))
  await database.delete(account).where(inArray(account.userId, ids))
  await database.delete(user).where(inArray(user.id, ids))
  console.log(`Deleted ${ids.length} unfinished signup(s)`)
}
