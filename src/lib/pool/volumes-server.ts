import { and, asc, eq, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { album, photo, volume } from '@/db/schema'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  createDriveFolder,
  deleteDriveFile,
  deleteDrivePermission,
  shareWithWriter,
} from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { newId } from '@/lib/albums/ids'
import { type Budget } from '@/lib/cron/budget'
import { planVolumeReleases, volumeFolderName } from './volumes'

type Database = ReturnType<typeof db>

export const VOLUME_RELEASES_PER_CALL = 20

const volumeKey = (albumId: string, userId: string) =>
  and(eq(volume.albumId, albumId), eq(volume.flamekeeperUserId, userId))

export async function ensureVolumeFolder(
  database: Database,
  masterToken: string,
  albumRow: { id: string; driveFolderId: string },
  fk: { userId: string; email: string }
): Promise<string> {
  const key = volumeKey(albumRow.id, fk.userId)
  const load = () =>
    database
      .select({
        driveFolderId: volume.driveFolderId,
        permissionId: volume.permissionId,
        writerRevokedAt: volume.writerRevokedAt,
      })
      .from(volume)
      .where(key)
      .get()

  const existing = await load()
  if (
    existing?.driveFolderId &&
    existing.permissionId &&
    !existing.writerRevokedAt
  ) {
    return existing.driveFolderId
  }

  let folderId = existing?.driveFolderId ?? null
  if (!folderId) {
    const created = await createDriveFolder(
      masterToken,
      volumeFolderName(newId(6)),
      albumRow.driveFolderId
    )
    const claimed = existing
      ? await database
          .update(volume)
          .set({
            driveFolderId: created.id,
            permissionId: '',
            writerRevokedAt: null,
            releaseBlockedAt: null,
          })
          .where(and(key, sql`${volume.driveFolderId} IS NULL`))
      : await database
          .insert(volume)
          .values({
            albumId: albumRow.id,
            flamekeeperUserId: fk.userId,
            permissionId: '',
            driveFolderId: created.id,
          })
          .onConflictDoNothing()
    if ((claimed.meta?.changes ?? 0) > 0) {
      folderId = created.id
    } else {
      try {
        await deleteDriveFile(masterToken, created.id)
      } catch (error) {
        console.warn('Failed to delete a spare volume folder:', error)
      }
      const winner = await load()
      if (!winner?.driveFolderId) {
        throw new Error('Could not set up your volume, try again')
      }
      folderId = winner.driveFolderId
      if (winner.permissionId && !winner.writerRevokedAt) return folderId
    }
  }

  const permissionId = await shareWithWriter(masterToken, folderId, fk.email)
  await database
    .update(volume)
    .set({ permissionId, writerRevokedAt: null, releaseBlockedAt: null })
    .where(key)
  return folderId
}

export async function forgetVolumeFolder(
  database: Database,
  albumId: string,
  userId: string
): Promise<void> {
  await database
    .update(volume)
    .set({ driveFolderId: null, permissionId: '', releaseBlockedAt: null })
    .where(volumeKey(albumId, userId))
}

export async function loadVolumeFolderId(
  database: Database,
  albumId: string,
  userId: string
): Promise<string | null> {
  const row = await database
    .select({ driveFolderId: volume.driveFolderId })
    .from(volume)
    .where(volumeKey(albumId, userId))
    .get()
  return row?.driveFolderId ?? null
}

export async function releaseVolumes(
  database: Database,
  scope: SQL | undefined,
  options: { limit?: number; budget?: Budget; now?: Date } = {}
): Promise<boolean> {
  const limit = options.limit ?? VOLUME_RELEASES_PER_CALL
  const now = options.now ?? new Date()

  const rows = await database
    .select({
      albumId: volume.albumId,
      flamekeeperUserId: volume.flamekeeperUserId,
      permissionId: volume.permissionId,
      driveFolderId: volume.driveFolderId,
      writerRevokedAt: volume.writerRevokedAt,
      releaseBlockedAt: volume.releaseBlockedAt,
      albumFolderId: album.driveFolderId,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(
      and(
        scope,
        sql`NOT EXISTS (SELECT 1 FROM ${photo} WHERE ${photo.albumId} = ${volume.albumId} AND ${photo.flamekeeperUserId} = ${volume.flamekeeperUserId} AND ${photo.state} != 'deleted')`
      )
    )
    .orderBy(asc(volume.releaseBlockedAt))
    .limit(limit + 1)
    .all()
  if (rows.length === 0) return true

  const plan = planVolumeReleases(
    rows.slice(0, limit).map((r) => ({ ...r, hasPhotos: false })),
    now,
    limit
  )
  let calls = plan.calls
  if (calls.length > 0 && options.budget) {
    const granted = options.budget.take(1)
      ? options.budget.takeUpTo(calls.length)
      : 0
    calls = calls.slice(0, granted)
  }
  const skipped = plan.calls.length - calls.length

  const done = [...plan.drops]
  if (calls.length > 0) {
    const masterToken = await getGoogleAccessToken()
    for (const { step, volume: v } of calls) {
      try {
        if (step === 'delete_folder') {
          await deleteDriveFile(masterToken, v.driveFolderId!)
        } else {
          await deleteDrivePermission(
            masterToken,
            v.albumFolderId,
            v.permissionId
          )
        }
        done.push(v)
      } catch (error) {
        if (error instanceof DriveNotFoundError) {
          done.push(v)
          continue
        }
        if (error instanceof DriveAppNotAuthorizedError) {
          console.warn(
            `Volume of ${v.flamekeeperUserId} in album ${v.albumId} still holds files in Drive, retrying later`
          )
        } else {
          console.warn(`Failed to release volume in album ${v.albumId}:`, error)
        }
        await database
          .update(volume)
          .set({ releaseBlockedAt: now })
          .where(volumeKey(v.albumId, v.flamekeeperUserId))
      }
    }
  }

  if (done.length > 0) {
    const statements = done.map((v) =>
      database.delete(volume).where(volumeKey(v.albumId, v.flamekeeperUserId))
    )
    await database.batch(statements as unknown as [(typeof statements)[0]])
  }
  return plan.pending.length === 0 && skipped === 0 && rows.length <= limit
}
