import { and, asc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeperGrant, photo, uploadReservation, volume } from '@/db/schema'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  batchDeleteDriveFiles,
  createDriveFolder,
  deleteDriveFile,
  listDriveFolderFileIds,
  shareWithWriter,
} from '@/lib/google/google-drive'
import { withFlamekeeperToken } from '@/lib/flamekeeper/tokens'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { newId } from '@/lib/albums/ids'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import {
  MAX_HEAL_DELETES,
  planHealDeletes,
  tallyHeals,
  type HealOutcome,
  type HealTally,
  planVolumeReleases,
  releaseAbandonedCutoff,
  volumeFolderName,
} from './volumes'

type Database = ReturnType<typeof db>

export const VOLUME_RELEASES_PER_CALL = 20
const HEALS_PER_CALL = 3
export const ALBUM_HEALS_PER_ATTEMPT = 4
const HEAL_COST = 3

export const clearedRelease = {
  releaseLastBlockedAt: null,
  releaseFirstBlockedAt: null,
  releaseAlertedAt: null,
}

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
        releaseLastBlockedAt: volume.releaseLastBlockedAt,
      })
      .from(volume)
      .where(key)
      .get()

  const existing = await load()
  if (existing?.driveFolderId && existing.permissionId) {
    if (existing.releaseLastBlockedAt) {
      await database.update(volume).set(clearedRelease).where(key)
    }
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
            ...clearedRelease,
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
      if (winner.permissionId) return folderId
    }
  }

  const permissionId = await shareWithWriter(masterToken, folderId, fk.email)
  await database
    .update(volume)
    .set({ permissionId, ...clearedRelease })
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
    .set({ driveFolderId: null, permissionId: '', ...clearedRelease })
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

export async function volumeHasPhotoRows(
  database: Database,
  albumId: string,
  userId: string
): Promise<boolean> {
  const row = await database
    .select({ id: photo.id })
    .from(photo)
    .where(
      and(
        eq(photo.albumId, albumId),
        eq(photo.flamekeeperUserId, userId),
        ne(photo.state, 'deleted')
      )
    )
    .limit(1)
    .get()
  return !!row
}

async function volumeIsIdle(
  database: Database,
  albumId: string,
  userId: string,
  now: Date
): Promise<boolean> {
  if (await volumeHasPhotoRows(database, albumId, userId)) return false
  const reserved = await database
    .select({ id: uploadReservation.id })
    .from(uploadReservation)
    .where(
      and(
        eq(uploadReservation.albumId, albumId),
        eq(uploadReservation.flamekeeperUserId, userId),
        sql`${uploadReservation.expiresAt} > ${now.getTime()}`
      )
    )
    .limit(1)
    .get()
  return !reserved
}

export interface HealResult {
  outcome: HealOutcome
  worked: boolean
}

export async function healBlockedVolume(
  database: Database,
  v: { albumId: string; flamekeeperUserId: string; driveFolderId: string },
  now: Date,
  budget?: Budget
): Promise<HealResult> {
  const grant = await database
    .select({ userId: flamekeeperGrant.userId })
    .from(flamekeeperGrant)
    .where(eq(flamekeeperGrant.userId, v.flamekeeperUserId))
    .get()
  if (!grant) return { outcome: 'blocked', worked: false }
  if (!takeIfBudgeted(budget, HEAL_COST)) {
    return { outcome: 'incomplete', worked: false }
  }

  try {
    const listed = await withFlamekeeperToken(
      database,
      v.flamekeeperUserId,
      (token) =>
        listDriveFolderFileIds(token, v.driveFolderId, MAX_HEAL_DELETES),
      budget
    )
    if (listed.length === 0) return { outcome: 'cleared', worked: false }
    const referenced = await database
      .select({ driveFileId: photo.driveFileId })
      .from(photo)
      .where(
        and(inArray(photo.driveFileId, listed), ne(photo.state, 'deleted'))
      )
      .all()
    const doomed = planHealDeletes(
      listed,
      referenced.map((r) => r.driveFileId)
    )
    if (doomed.length === 0) return { outcome: 'blocked', worked: false }
    if (!(await volumeIsIdle(database, v.albumId, v.flamekeeperUserId, now))) {
      return { outcome: 'blocked', worked: false }
    }
    await withFlamekeeperToken(
      database,
      v.flamekeeperUserId,
      (token) => batchDeleteDriveFiles(token, doomed),
      budget
    )
    return {
      outcome: listed.length >= MAX_HEAL_DELETES ? 'incomplete' : 'cleared',
      worked: true,
    }
  } catch (error) {
    console.warn(
      `Could not clear leftover files of ${v.flamekeeperUserId} in album ${v.albumId}:`,
      error
    )
    return { outcome: 'blocked', worked: false }
  }
}

export async function healAlbumVolumes(
  database: Database,
  albumId: string,
  now: Date,
  budget?: Budget
): Promise<HealTally> {
  const rows = await database
    .select({
      albumId: volume.albumId,
      flamekeeperUserId: volume.flamekeeperUserId,
      driveFolderId: volume.driveFolderId,
    })
    .from(volume)
    .where(
      and(eq(volume.albumId, albumId), sql`${volume.driveFolderId} IS NOT NULL`)
    )
    .all()
  const outcomes: HealOutcome[] = []
  let worked = 0
  for (const v of rows) {
    if (worked >= ALBUM_HEALS_PER_ATTEMPT) {
      outcomes.push('incomplete')
      continue
    }
    const healed = await healBlockedVolume(
      database,
      { ...v, driveFolderId: v.driveFolderId! },
      now,
      budget
    )
    if (healed.worked) worked++
    outcomes.push(healed.outcome)
  }
  return tallyHeals(outcomes)
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
      driveFolderId: volume.driveFolderId,
      releaseLastBlockedAt: volume.releaseLastBlockedAt,
      releaseFirstBlockedAt: volume.releaseFirstBlockedAt,
      releaseAlertedAt: volume.releaseAlertedAt,
    })
    .from(volume)
    .where(
      and(
        scope,
        sql`NOT (${volume.releaseAlertedAt} IS NOT NULL AND ${volume.releaseFirstBlockedAt} <= ${releaseAbandonedCutoff(now).getTime()})`,
        sql`NOT EXISTS (SELECT 1 FROM ${photo} WHERE ${photo.albumId} = ${volume.albumId} AND ${photo.flamekeeperUserId} = ${volume.flamekeeperUserId} AND ${photo.state} != 'deleted')`,
        sql`NOT EXISTS (SELECT 1 FROM ${uploadReservation} WHERE ${uploadReservation.albumId} = ${volume.albumId} AND ${uploadReservation.flamekeeperUserId} = ${volume.flamekeeperUserId} AND ${uploadReservation.expiresAt} > ${now.getTime()})`
      )
    )
    .orderBy(asc(volume.releaseLastBlockedAt))
    .limit(limit + 1)
    .all()
  if (rows.length === 0) return true

  const plan = planVolumeReleases(rows.slice(0, limit), now, limit)
  let calls = plan.calls
  if (calls.length > 0 && options.budget) {
    const granted = options.budget.take(1)
      ? options.budget.takeUpTo(calls.length)
      : 0
    calls = calls.slice(0, granted)
  }
  const skipped = plan.calls.length - calls.length

  const done = [...plan.drops]
  let heals = 0
  for (const v of calls) {
    const folderId = v.driveFolderId!
    if (!(await volumeIsIdle(database, v.albumId, v.flamekeeperUserId, now))) {
      continue
    }
    const remove = () =>
      withGoogleToken(
        (masterToken) => deleteDriveFile(masterToken, folderId),
        options.budget
      )
    try {
      try {
        await remove()
      } catch (error) {
        if (!(error instanceof DriveAppNotAuthorizedError)) throw error
        console.warn(
          `Volume of ${v.flamekeeperUserId} in album ${v.albumId} still holds files in Drive`
        )
        if (heals >= HEALS_PER_CALL) throw error
        heals++
        const healed = await healBlockedVolume(
          database,
          { ...v, driveFolderId: folderId },
          now,
          options.budget
        )
        if (healed.outcome !== 'cleared' || !takeIfBudgeted(options.budget, 1))
          throw error
        await remove()
      }
      done.push(v)
    } catch (error) {
      if (error instanceof DriveNotFoundError) {
        done.push(v)
        continue
      }
      if (!(error instanceof DriveAppNotAuthorizedError)) {
        console.warn(`Failed to release volume in album ${v.albumId}:`, error)
      }
      await database
        .update(volume)
        .set({
          releaseLastBlockedAt: now,
          releaseFirstBlockedAt: sql`COALESCE(${volume.releaseFirstBlockedAt}, ${now.getTime()})`,
        })
        .where(volumeKey(v.albumId, v.flamekeeperUserId))
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
