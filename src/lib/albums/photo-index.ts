import { and, eq, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { db, type Database } from '@/db'
import { album, photo } from '@/db/schema'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { chunk } from '@/lib/utils'
import { newId } from './ids'
import {
  MAX_ALBUMS_PER_RUN,
  MAX_PHOTOS_PER_RUN,
  PHOTO_INSERT_CHUNK,
  budgetDayKey,
  driveFileToPhotoValues,
  isImage,
  missingFromTable,
  parseDailyWriteBudget,
  photoWriteCost,
  photosAffordable,
  recordSpend,
  rollBudget,
  selectNextAlbum,
  sumBytes,
} from './photo-backfill'
import type { BudgetState, DriveFileLike } from './photo-backfill'
import {
  DriveNotFoundError,
  getDriveFileMeta,
  getDriveFolderState,
  listDriveFolderFiles,
} from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'

const BUDGET_KEY = 'photo-backfill:budget'
const BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60

export async function registerDrivePhotos(
  database: Database,
  albumId: string,
  files: DriveFileLike[],
  markIndexed: boolean,
  flamekeeperUserId: string | null = null
): Promise<number> {
  const now = new Date()
  const values = files.map((f) => ({
    ...driveFileToPhotoValues(f, albumId, newId(16), now),
    flamekeeperUserId,
  }))
  const inserted: { bytes: number }[] = []

  if (values.length > 0) {
    const statements = chunk(values, PHOTO_INSERT_CHUNK).map((rows) =>
      database
        .insert(photo)
        .values(rows)
        .onConflictDoNothing({ target: photo.driveFileId })
        .returning({ bytes: photo.bytes })
    )
    const results = await database.batch(
      statements as unknown as [(typeof statements)[0]]
    )
    for (const rows of results) inserted.push(...rows)
  }

  if (inserted.length > 0 || markIndexed) {
    await database
      .update(album)
      .set({
        photoCount: sql`${album.photoCount} + ${inserted.length}`,
        photoBytes: sql`${album.photoBytes} + ${sumBytes(inserted)}`,
        ...(markIndexed ? { photosIndexedAt: now } : {}),
      })
      .where(eq(album.id, albumId))
  }
  return inserted.length
}

export async function registerDriveFileById(
  database: Database,
  accessToken: string,
  albumRow: { id: string; driveFolderId: string },
  fileId: string
): Promise<boolean> {
  const file = await getDriveFileMeta(accessToken, fileId)
  if (file.trashed || !file.parents?.includes(albumRow.driveFolderId)) {
    throw new Error('Uploaded file not found in the album folder')
  }
  if (!isImage(file)) return false
  const inserted = await registerDrivePhotos(
    database,
    albumRow.id,
    [file],
    false
  )
  return inserted > 0
}

export async function requestAlbumIndex(
  database: Database,
  albumId: string
): Promise<void> {
  try {
    await database
      .update(album)
      .set({ photosIndexRequestedAt: new Date() })
      .where(
        and(
          eq(album.id, albumId),
          isNull(album.photosIndexedAt),
          isNull(album.photosIndexRequestedAt),
          isNull(album.photosIndexSkipped)
        )
      )
  } catch (error) {
    console.warn('Failed to request album photo indexing:', error)
  }
}

export async function resetAlbumPhotos(
  database: Database,
  albumId: string,
  before: BatchItem<'sqlite'>[] = []
): Promise<void> {
  const statements = [
    ...before,
    database.delete(photo).where(eq(photo.albumId, albumId)),
    database
      .update(album)
      .set({
        photoCount: 0,
        photoBytes: 0,
        favoriteCount: 0,
        photosIndexedAt: new Date(),
        photosIndexSkipped: null,
        coverFileId: null,
      })
      .where(eq(album.id, albumId)),
  ]
  await database.batch(statements as unknown as [(typeof statements)[0]])
}

async function readBudget(kv: KVNamespace): Promise<BudgetState | null> {
  try {
    const raw = await kv.get(BUDGET_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BudgetState>
    if (typeof parsed.day !== 'string' || typeof parsed.spent !== 'number') {
      return null
    }
    return { day: parsed.day, spent: parsed.spent }
  } catch {
    return null
  }
}

export async function runPhotoBackfill(
  env: {
    meriksirat_d1: D1Database
    meriksirat_kv: KVNamespace
  },
  cronBudget?: Budget
): Promise<void> {
  const budget = parseDailyWriteBudget(
    process.env.PHOTO_BACKFILL_DAILY_WRITE_BUDGET
  )
  const startState = rollBudget(
    await readBudget(env.meriksirat_kv),
    budgetDayKey(new Date())
  )
  let state = startState
  if (photosAffordable(budget, state.spent) === 0) return

  const database = db(env.meriksirat_d1)
  const rows = await database
    .select({
      id: album.id,
      driveFolderId: album.driveFolderId,
      eventDate: album.eventDate,
      createdAt: album.createdAt,
      requestedAt: album.photosIndexRequestedAt,
    })
    .from(album)
    .where(
      and(
        isNull(album.photosIndexedAt),
        isNull(album.photosIndexSkipped),
        isNull(album.deletedAt)
      )
    )
    .all()
  if (rows.length === 0) return

  const byId = new Map(rows.map((r) => [r.id, r]))
  const candidates = rows.map((r) => ({
    id: r.id,
    sortTime: (r.eventDate ?? r.createdAt).getTime(),
    requestedAt: r.requestedAt ? r.requestedAt.getTime() : null,
  }))

  if (!takeIfBudgeted(cronBudget, 1)) return
  const accessToken = await getGoogleAccessToken()
  const done = new Set<string>()
  let photosLeft = MAX_PHOTOS_PER_RUN

  try {
    for (let n = 0; n < MAX_ALBUMS_PER_RUN; n++) {
      const afford = photosAffordable(budget, state.spent, photosLeft)
      if (afford === 0) break
      if (!takeIfBudgeted(cronBudget, 2)) break
      const next = selectNextAlbum(candidates, done)
      if (!next) break
      done.add(next.id)
      const row = byId.get(next.id)!

      try {
        const folderState = await getDriveFolderState(
          accessToken,
          row.driveFolderId
        )
        if (folderState !== 'ok') {
          await database
            .update(album)
            .set({ photosIndexSkipped: folderState })
            .where(eq(album.id, row.id))
          state = recordSpend(state, 1)
          continue
        }

        let pages = 0
        const files = await listDriveFolderFiles(
          accessToken,
          row.driveFolderId,
          () => {
            if (pages++ > 0) cronBudget?.spend(1)
          }
        )
        const known = await database
          .select({ driveFileId: photo.driveFileId })
          .from(photo)
          .where(eq(photo.albumId, row.id))
          .all()
        const missing = missingFromTable(
          files,
          known.map((k) => k.driveFileId)
        )
        const take = missing.slice(0, afford)
        const complete = take.length === missing.length
        await registerDrivePhotos(database, row.id, take, complete)
        state = recordSpend(state, Math.max(photoWriteCost(take.length), 1))
        photosLeft -= take.length
      } catch (error) {
        if (error instanceof DriveNotFoundError) {
          await database
            .update(album)
            .set({ photosIndexSkipped: 'missing' })
            .where(eq(album.id, row.id))
          state = recordSpend(state, 1)
        } else {
          console.error(`Photo backfill failed for album ${row.id}:`, error)
        }
      }
    }
  } finally {
    if (state !== startState) {
      await env.meriksirat_kv
        .put(BUDGET_KEY, JSON.stringify(state), {
          expirationTtl: BUDGET_TTL_SECONDS,
        })
        .catch((error) =>
          console.warn('Failed to persist photo backfill budget:', error)
        )
    }
  }
}
