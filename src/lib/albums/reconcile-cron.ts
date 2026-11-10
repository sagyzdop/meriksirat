import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { album } from '@/db/schema'
import type { Budget } from '@/lib/cron/budget'
import { LISTING_RECONCILE_MS } from './listing'
import { loadAlbumListing } from './listing-server'

const ALBUMS_PER_RUN = 10
// Folder check, one token and at least one listing page per source.
const MIN_ALBUM_COST = 6

/**
 * Hourly step: compare the stored photo rows with Drive for the albums checked
 * longest ago, with whatever the earlier steps left of the run's budget. This
 * is what notices photos added, changed or removed in Drive behind the app.
 */
export async function runAlbumReconcile(
  env: { meriksirat_d1: D1Database },
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const cutoff = new Date(Date.now() - LISTING_RECONCILE_MS)

  const due = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(
      and(
        isNull(album.deletedAt),
        or(isNull(album.photosCheckedAt), lt(album.photosCheckedAt, cutoff))
      )
    )
    .orderBy(asc(album.photosCheckedAt))
    .limit(ALBUMS_PER_RUN)
    .all()

  let checked = 0
  for (const row of due) {
    if (!budget.canAfford(MIN_ALBUM_COST)) break
    try {
      await loadAlbumListing(database, row, { force: true, budget })
    } catch (error) {
      console.warn(`Could not reconcile album ${row.id}:`, error)
    }
    await database
      .update(album)
      .set({ photosCheckedAt: new Date(), updatedAt: sql`${album.updatedAt}` })
      .where(eq(album.id, row.id))
    checked += 1
  }
  if (checked > 0) console.log(`[cron] reconciled ${checked} albums`)
}
