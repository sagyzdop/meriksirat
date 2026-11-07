import { and, asc, isNotNull, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { album } from '@/db/schema'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { AlbumDeletionDeferredError, removeAlbum } from './remove'

const DELETIONS_PER_RUN = 3
const MIN_ALBUM_COST = 8

export async function runScheduledDeletion(
  env: { meriksirat_d1: D1Database },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const due = await database
    .select({
      id: album.id,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
    })
    .from(album)
    .where(
      and(
        isNull(album.deletedAt),
        isNotNull(album.scheduledDeletionAt),
        lte(album.scheduledDeletionAt, now)
      )
    )
    .orderBy(asc(album.scheduledDeletionAt))
    .all()
  if (due.length === 0) return

  const { rotateIds } = await import('@/lib/pool/volumes')
  const byId = new Map(due.map((r) => [r.id, r]))
  const turn = Math.floor(now.getTime() / (60 * 60 * 1000))
  let accessToken: string | null = null
  let removed = 0

  for (const id of rotateIds([...byId.keys()], turn)) {
    if (removed >= DELETIONS_PER_RUN) break
    try {
      if (budget && !budget.canAfford(MIN_ALBUM_COST)) continue
      if (!accessToken) {
        if (!takeIfBudgeted(budget, 1)) continue
        accessToken = await getGoogleAccessToken()
      }
      removed++
      await removeAlbum(database, byId.get(id)!, accessToken, {
        strictDrive: true,
        budget,
      })
    } catch (error) {
      if (error instanceof AlbumDeletionDeferredError) {
        console.warn(
          `Scheduled deletion of album ${id} deferred to a later run`
        )
        continue
      }
      console.error(`Failed to delete scheduled album ${id}:`, error)
    }
  }
}
