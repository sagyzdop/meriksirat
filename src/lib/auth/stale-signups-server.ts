import { and, eq, inArray, isNull, lte, notLike, sql } from 'drizzle-orm'
import { db } from '@/db'
import { account, session, user } from '@/db/schema'
import { ALUMNI_EMAIL_LIKE } from './signup-domain'
import {
  STALE_SIGNUP_MAX_DELETES,
  selectStaleSignups,
  staleCutoff,
} from './stale-signups'

const OWNS_ANYTHING = sql<number>`(
  EXISTS (SELECT 1 FROM booking WHERE booking.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM album WHERE album.owner_user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM album_member WHERE album_member.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM favorite WHERE favorite.user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM volume WHERE volume.flamekeeper_user_id = ${user.id})
  OR EXISTS (SELECT 1 FROM photo WHERE photo.flamekeeper_user_id = ${user.id})
)`

const HAS_FLAMEKEEPER = sql<number>`EXISTS (SELECT 1 FROM flamekeeper WHERE flamekeeper.user_id = ${user.id})`
const HAS_DRIVE_GRANT = sql<number>`EXISTS (SELECT 1 FROM flamekeeper_grant WHERE flamekeeper_grant.user_id = ${user.id})`

export async function runStaleSignupCleanup(env: {
  meriksirat_d1: D1Database
  GOOGLE_MASTER_EMAIL?: string
}): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()
  const cutoff = staleCutoff(now)
  const masterEmail = (env.GOOGLE_MASTER_EMAIL ?? '').trim().toLowerCase()

  const rows = await database
    .select({
      id: user.id,
      email: user.email,
      isMember: user.isMember,
      hasFlamekeeperRecord: HAS_FLAMEKEEPER,
      hasDriveGrant: HAS_DRIVE_GRANT,
      createdAt: user.createdAt,
      bannedAt: user.bannedAt,
      ownsAnything: OWNS_ANYTHING,
    })
    .from(user)
    .where(
      and(
        eq(user.isMember, false),
        isNull(user.bannedAt),
        notLike(user.email, ALUMNI_EMAIL_LIKE),
        masterEmail
          ? sql`lower(trim(${user.email})) != ${masterEmail}`
          : undefined,
        lte(user.createdAt, cutoff),
        sql`NOT ${HAS_FLAMEKEEPER}`,
        sql`NOT ${HAS_DRIVE_GRANT}`,
        sql`NOT ${OWNS_ANYTHING}`
      )
    )
    .orderBy(user.createdAt)
    .limit(STALE_SIGNUP_MAX_DELETES * 5)
    .all()

  const ids = selectStaleSignups(
    rows.map((r) => ({
      ...r,
      hasFlamekeeperRecord: !!r.hasFlamekeeperRecord,
      hasDriveGrant: !!r.hasDriveGrant,
      ownsAnything: !!r.ownsAnything,
    })),
    now
  )
  if (ids.length === 0) return

  await database.delete(session).where(inArray(session.userId, ids))
  await database.delete(account).where(inArray(account.userId, ids))
  await database.delete(user).where(inArray(user.id, ids))
  console.log(`Deleted ${ids.length} unfinished signup(s)`)
}
