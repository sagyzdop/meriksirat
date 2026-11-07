import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, favorite, user, volume } from '@/db/schema'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  deleteDriveFile,
} from '@/lib/google/google-drive'
import {
  RUN_SUBREQUEST_BUDGET,
  createBudget,
  type Budget,
} from '@/lib/cron/budget'
import type { TombstoneReason } from './tombstone'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'

type AlbumRecord = typeof album.$inferSelect

export class AlbumDeletionDeferredError extends Error {
  constructor() {
    super(
      'This album is too large to delete in one go. Some photos were deleted; try again to continue.'
    )
    this.name = 'AlbumDeletionDeferredError'
  }
}

async function deleteAlbumFolder(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId'>,
  accessToken: string,
  options: { strictDrive?: boolean; budget?: Budget }
): Promise<void> {
  try {
    await deleteDriveFile(accessToken, row.driveFolderId)
  } catch (error) {
    if (error instanceof DriveNotFoundError) return
    if (error instanceof DriveAppNotAuthorizedError) {
      console.warn(
        `Album ${row.id} keeps its Drive folder: it still holds files the club account cannot delete`
      )
      const alerted = await alertBlockedAlbum(database, row.id, options.budget)
      if (!alerted) throw new AlbumDeletionDeferredError()
      return
    }
    if (options.strictDrive) throw error
    console.warn(
      'Failed to delete Drive folder, continuing with DB cleanup:',
      error
    )
  }
}

async function alertBlockedAlbum(
  database: Database,
  albumId: string,
  budget?: Budget
): Promise<boolean> {
  try {
    const { env } = await import('cloudflare:workers')
    const { sendAdminsTelegramResult } = await import('@/lib/pool/server')
    const { albumBlockedAlertText } = await import('@/lib/pool/volumes')
    const result = await sendAdminsTelegramResult(
      database,
      (env as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN,
      albumBlockedAlertText(albumId, 0),
      budget
    )
    if (result === 'no_admins') {
      console.warn(`No admin to alert about album ${albumId}`)
    }
    return result !== 'over_budget'
  } catch (error) {
    console.warn(`Could not alert admins about album ${albumId}:`, error)
    return true
  }
}

export async function removeAlbum(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId' | 'ownerUserId' | 'deletedAt'>,
  accessToken: string,
  options: {
    tombstone?: TombstoneReason
    strictDrive?: boolean
    budget?: Budget
  } = {}
): Promise<void> {
  const budget = options.budget ?? createBudget(RUN_SUBREQUEST_BUDGET)
  const { tearDownAlbumFiles } = await import('./teardown-server')
  if ((await tearDownAlbumFiles(database, row, budget)) === 'retry') {
    throw new AlbumDeletionDeferredError()
  }
  await deleteAlbumFolder(database, row, accessToken, { ...options, budget })
  await invalidateCachedListing(row.driveFolderId)
  await invalidateCachedDetailCore(row.id)

  if (options.tombstone) {
    await database.delete(favorite).where(eq(favorite.albumId, row.id))
    await database.delete(volume).where(eq(volume.albumId, row.id))
    await database
      .update(album)
      .set({
        deletedAt: new Date(),
        tombstoneReason: options.tombstone,
        photoCount: 0,
        photoBytes: 0,
        coverFileId: null,
        updatedAt: new Date(),
      })
      .where(eq(album.id, row.id))
  } else {
    await database.delete(album).where(eq(album.id, row.id))
  }

  if (!row.deletedAt) {
    await database
      .update(user)
      .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
      .where(eq(user.id, row.ownerUserId))
  }
}

export async function tombstoneGoneAlbum(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId' | 'ownerUserId' | 'deletedAt'>
): Promise<void> {
  await database.delete(favorite).where(eq(favorite.albumId, row.id))
  await database.delete(volume).where(eq(volume.albumId, row.id))
  await database
    .update(album)
    .set({
      deletedAt: new Date(),
      tombstoneReason: 'folder_deleted',
      photoCount: 0,
      photoBytes: 0,
      coverFileId: null,
      updatedAt: new Date(),
    })
    .where(eq(album.id, row.id))
  await invalidateCachedListing(row.driveFolderId)
  await invalidateCachedDetailCore(row.id)
  if (!row.deletedAt) {
    await database
      .update(user)
      .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
      .where(eq(user.id, row.ownerUserId))
  }
}
